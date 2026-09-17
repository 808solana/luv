"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";

import { ShieldedImage } from "@/components/ui/shielded-image";

/**
 * A raster is 2.7:1 or wider on this site and the phone in your hand is
 * portrait, so the fit view is a thin strip. `OPEN_FILL` opens the viewer at
 * whatever scale makes the raster about 55% of the stage height instead, which
 * is legible — and `1` (fit) is still one pinch or one `−` away.
 */
const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.5;
/** Where a double-tap lands when the raster is at fit. */
const DOUBLE_TAP_SCALE = 2.6;
/** Scale per wheel pixel. */
const WHEEL_SENSITIVITY = 0.0022;
/** Pointer movement above this (px) is a pan, not a tap. */
const TAP_SLOP = 8;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_SLOP = 28;
/** Arrow-key pan distance. */
const KEY_PAN = 56;
const OPEN_FILL = 0.55;
const OPEN_FILL_MAX = 3;

const FOCUSABLE =
  'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

type Point = { x: number; y: number };
type View = { scale: number; x: number; y: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Full-screen, pannable zoom viewer for a shielded raster.
 *
 * Mount it to open it; unmounting closes it. The raster is painted with
 * `ShieldedImage` (a CSS background `span`, never an `<img>`) so the viewer
 * keeps the rest of the site's "no image context menu" property, and it
 * portals to `<body>` so no transformed or clipped ancestor can trap it.
 *
 * Zoom is anchored: a pinch, a wheel notch and a double-tap all scale around
 * the point under your fingers/cursor rather than the centre of the screen.
 *
 * Given `onPrev`/`onNext` it becomes a viewer *of a set*: `‹ ›` are always on
 * screen so the next chart is one press away instead of close → step in the
 * carousel → zoom again. They **float over the raster from `sm` up**, where
 * there is room to spare, and **drop into their own row under it on phones**:
 * a 375px stage is exactly the raster's width at fit, so a floating 44px pill
 * each side sits on ~12% of the chart. Below `sm` the row is in flow (arrow ·
 * `1 / 2` · arrow) and nothing is covered; from `sm` up it is the
 * `absolute inset-0` overlay it has always been, and the chip goes back to the
 * stage's bottom centre. Stepping deliberately **keeps the transform** (the
 * set shares one ratio, so `2.4×` on chart 1 is the same crop of chart 2) —
 * the zoom the visitor framed survives the step.
 */
export function ImageZoomOverlay({
  src,
  alt,
  ratio,
  label,
  position,
  onPrev,
  onNext,
  onClose,
}: {
  /** Raster URL — same one the trigger paints. */
  src: string;
  /** Real description; reaches the raster's `role="img"` name. */
  alt: string;
  /** Raster width / height, so the fit box keeps the file's ratio. */
  ratio: number;
  /** Accessible name for the viewer itself, e.g. `Artificial Analysis chart zoom`. */
  label: string;
  /** Where `src` sits in the caller's set, so the viewer can show `1 / 3`. */
  position?: { index: number; total: number };
  /** Step to the previous raster without leaving the viewer. Omit to hide the control. */
  onPrev?: () => void;
  /** Step to the next raster without leaving the viewer. Omit to hide the control. */
  onNext?: () => void;
  onClose: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  /** Measured stage, in CSS px. Read by the pointer maths, never rendered. */
  const stageSize = useRef({ w: 0, h: 0 });
  /** The truth for the transform. `applied` is only its rendered mirror. */
  const view = useRef<View>({ scale: MIN_SCALE, x: 0, y: 0 });
  const pointers = useRef(new Map<number, Point>());
  const pan = useRef<{ id: number; from: Point; origin: Point } | null>(null);
  const pinch = useRef<{
    distance: number;
    scale: number;
    mid: Point;
    origin: Point;
  } | null>(null);
  const lastTap = useRef<{ at: number; point: Point } | null>(null);
  /** A gesture that moved is a pan, and must not also count as a tap. */
  const moved = useRef(false);
  /** The stage rect at gesture start, for client → stage-centre conversion. */
  const rect = useRef<DOMRect | null>(null);
  /** Whether the current gesture started on the raster rather than the ground. */
  const onRaster = useRef(false);

  const [box, setBox] = useState({ width: 0, height: 0 });
  const [applied, setApplied] = useState<View>({
    scale: MIN_SCALE,
    x: 0,
    y: 0,
  });
  const [interacting, setInteracting] = useState(false);

  const fitBox = useCallback(() => {
    const { w, h } = stageSize.current;
    const width = Math.min(w, h * ratio);
    return { width, height: width / ratio, stageW: w, stageH: h };
  }, [ratio]);

  /** Scale that fills `OPEN_FILL` of the stage height, inside the 1–3 band. */
  const openScale = useCallback(
    (height: number, stageH: number) =>
      stageH > 0 && height > 0
        ? clamp((stageH * OPEN_FILL) / height, MIN_SCALE, OPEN_FILL_MAX)
        : MIN_SCALE,
    [],
  );

  /** Writes a clamped transform to both the ref and React. */
  const apply = useCallback(
    (next: View) => {
      const { width, height, stageW, stageH } = fitBox();
      const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
      const maxX = Math.max(0, (width * scale - stageW) / 2);
      const maxY = Math.max(0, (height * scale - stageH) / 2);
      const value = {
        scale,
        x: clamp(next.x, -maxX, maxX),
        y: clamp(next.y, -maxY, maxY),
      };
      view.current = value;
      setApplied(value);
    },
    [fitBox],
  );

  /** Zoom keeping `anchor` (stage-centre coordinates) under the same ink. */
  const zoomTo = useCallback(
    (scale: number, anchor: Point = { x: 0, y: 0 }) => {
      const current = view.current;
      const next = clamp(scale, MIN_SCALE, MAX_SCALE);
      const step = next / current.scale;
      apply({
        scale: next,
        x: anchor.x - step * (anchor.x - current.x),
        y: anchor.y - step * (anchor.y - current.y),
      });
    },
    [apply],
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const current = view.current;
      apply({ scale: current.scale, x: current.x + dx, y: current.y + dy });
    },
    [apply],
  );

  /** The whole raster, centred: scale 1 is by definition the fit view. */
  const fitWhole = useCallback(() => {
    apply({ scale: MIN_SCALE, x: 0, y: 0 });
  }, [apply]);

  const measure = useCallback(
    (stage: HTMLDivElement) => {
      stageSize.current = { w: stage.clientWidth, h: stage.clientHeight };
      const sized = fitBox();
      setBox({ width: sized.width, height: sized.height });
      return sized;
    },
    [fitBox],
  );

  /**
   * Runs from the stage's ref callback, i.e. during the commit — so the viewer
   * is already at its opening scale on the first paint instead of flashing the
   * fit view first.
   */
  const attachStage = useCallback(
    (node: HTMLDivElement | null) => {
      stageRef.current = node;
      if (!node) return;
      const { height, stageH } = measure(node);
      apply({ scale: openScale(height, stageH), x: 0, y: 0 });
    },
    [apply, measure, openScale],
  );

  // Client point → coordinates relative to the stage centre.
  const toStage = useCallback((point: Point, bounds?: DOMRect) => {
    const stage = bounds ?? rect.current;
    if (!stage) return { x: 0, y: 0 };
    return {
      x: point.x - (stage.left + stage.width / 2),
      y: point.y - (stage.top + stage.height / 2),
    };
  }, []);

  // Stay honest across resizes: re-derive the fit box and re-clamp the view
  // (a rotate or a URL bar can leave the old offset out of bounds).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => {
      measure(stage);
      apply(view.current);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [apply, measure]);

  // Take focus on open and hand it back to the trigger on close. **Mount-only**:
  // the callers of this viewer pass fresh closures per render, so anything that
  // re-focuses in an effect body would steal focus off the control the visitor
  // just pressed (press `Next`, focus lands on Close, `Enter` closes the
  // viewer). The listener effect below is free to re-run; this one is not.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  // Escape closes; `+`/`−`/`0` zoom; arrows pan once there is somewhere to go.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomTo(view.current.scale * ZOOM_STEP);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomTo(view.current.scale / ZOOM_STEP);
        return;
      }
      if (event.key === "0") {
        event.preventDefault();
        fitWhole();
        return;
      }
      if (view.current.scale > MIN_SCALE) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          panBy(KEY_PAN, 0);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          panBy(-KEY_PAN, 0);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          panBy(0, KEY_PAN);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          panBy(0, -KEY_PAN);
          return;
        }
      }
      // At fit there is nothing to pan, so the horizontal arrows step through
      // the set instead — the keyboard twin of the viewer's own ‹ › controls.
      // Zoomed, they keep panning (see the block above); `Tab` still reaches
      // the buttons at any scale.
      if (event.key === "ArrowLeft" && onPrev) {
        event.preventDefault();
        onPrev();
        return;
      }
      if (event.key === "ArrowRight" && onNext) {
        event.preventDefault();
        onNext();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, onNext, onPrev, panBy, fitWhole, zoomTo]);

  // Lock the page behind. `data-lenis-prevent` + `overflow: hidden` cover the
  // desktop wheel and the native touch scroller; the gutter is paid back as
  // body padding so nothing reflows when the scrollbar disappears.
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previous = {
      root: root.style.overflow,
      body: body.style.overflow,
      padding: body.style.paddingRight,
    };
    const gutter = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
    return () => {
      root.style.overflow = previous.root;
      body.style.overflow = previous.body;
      body.style.paddingRight = previous.padding;
    };
  }, []);

  // Wheel zoom needs `passive: false` to be able to swallow the event, so it
  // is a real listener rather than React's (passive) `onWheel`.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      zoomTo(
        view.current.scale * Math.exp(-event.deltaY * WHEEL_SENSITIVITY),
        toStage(
          { x: event.clientX, y: event.clientY },
          stage.getBoundingClientRect(),
        ),
      );
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [toStage, zoomTo]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const stage = stageRef.current;
    if (!stage) return;
    const target = event.target as Element | null;
    rect.current = stage.getBoundingClientRect();
    try {
      // Guarded: capturing demands a live pointer id, so a synthetic
      // (dispatched) gesture — and a pointer that dies mid-press — lands here
      // and is harmless rather than throwing out of the handler.
      stage.setPointerCapture(event.pointerId);
    } catch {
      /* no capture available; the handlers below still track the pointer */
    }
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    moved.current = false;
    onRaster.current = Boolean(target?.closest("[data-zoom-raster]"));
    setInteracting(true);

    if (pointers.current.size === 1) {
      const current = view.current;
      pan.current = {
        id: event.pointerId,
        from: { x: event.clientX, y: event.clientY },
        origin: { x: current.x, y: current.y },
      };
      return;
    }

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const current = view.current;
      pinch.current = {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        scale: current.scale,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        origin: { x: current.x, y: current.y },
      };
      pan.current = null;
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const grip = pinch.current;
    if (grip && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = clamp(
        grip.scale * (distance / grip.distance),
        MIN_SCALE,
        MAX_SCALE,
      );
      const step = scale / grip.scale;
      const anchor = toStage(grip.mid);
      const now = toStage(mid);
      moved.current = true;
      apply({
        scale,
        x: now.x - step * (anchor.x - grip.origin.x),
        y: now.y - step * (anchor.y - grip.origin.y),
      });
      return;
    }

    const drag = pan.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.from.x;
    const dy = event.clientY - drag.from.y;
    if (!moved.current && Math.hypot(dx, dy) > TAP_SLOP) {
      moved.current = true;
      // A pan is not the first half of a double-tap.
      lastTap.current = null;
    }
    if (!moved.current) return;
    apply({
      scale: view.current.scale,
      x: drag.origin.x + dx,
      y: drag.origin.y + dy,
    });
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (stage?.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }
    pointers.current.delete(event.pointerId);

    if (pointers.current.size < 2) pinch.current = null;

    if (pointers.current.size === 1) {
      const [[id, point]] = [...pointers.current.entries()];
      const current = view.current;
      pan.current = {
        id,
        from: { x: point.x, y: point.y },
        origin: { x: current.x, y: current.y },
      };
      return;
    }

    if (pointers.current.size > 0) return;
    pan.current = null;
    setInteracting(false);
    if (moved.current) return;

    const point = { x: event.clientX, y: event.clientY };
    if (!onRaster.current) {
      // A tap on the dark ground dismisses the viewer. Done from the pointer
      // stream rather than a `click` listener: pointer capture retargets the
      // compatibility mouse events, so a click handler is not reliable here.
      lastTap.current = null;
      onClose();
      return;
    }

    // Two taps in quick succession toggle the zoom around the tap point — the
    // gesture every phone photo viewer has trained people to try.
    const now = performance.now();
    const last = lastTap.current;
    if (
      last &&
      now - last.at < DOUBLE_TAP_MS &&
      Math.hypot(point.x - last.point.x, point.y - last.point.y) <
        DOUBLE_TAP_SLOP
    ) {
      lastTap.current = null;
      zoomTo(
        view.current.scale > MIN_SCALE * 1.05 ? MIN_SCALE : DOUBLE_TAP_SCALE,
        toStage(point),
      );
      return;
    }
    lastTap.current = { at: now, point };
  };

  const zoomed = applied.scale > MIN_SCALE + 0.001;
  /** `1 / 2`, or `null` when the viewer was not given a set to describe. */
  const positionChip =
    position && position.total > 1
      ? `${position.index} / ${position.total}`
      : null;
  const boxStyle: CSSProperties = {
    width: box.width,
    height: box.height,
    transform: `translate3d(${applied.x}px, ${applied.y}px, 0) scale(${applied.scale})`,
    transformOrigin: "center center",
    transition: interacting
      ? "none"
      : "transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
    willChange: "transform",
  };

  const control =
    "flex size-11 items-center justify-center rounded-full bg-paper text-ink transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:opacity-40 disabled:active:scale-100";

  // Steppers. From `sm` up they float: a sibling row of the stage rather than
  // children of it, so a press on one never enters the stage's pointer stream —
  // otherwise `endPointer` would read the press as a tap on the ground and
  // dismiss the viewer. On phones the same row is *in flow under the stage*
  // (`sm:absolute` is what turns it back into an overlay), because at 375px the
  // fit view is the full stage width and a floating pill would cover the chart.
  // Slightly translucent only where it actually overlaps the raster.
  const navControl =
    "pointer-events-auto flex size-11 items-center justify-center rounded-full bg-paper text-ink shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)] transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:bg-paper/85 sm:backdrop-blur-sm";

  return createPortal(
    <div
      ref={dialogRef}
      data-lenis-prevent
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[100] flex flex-col bg-ink/95 animate-in fade-in"
    >
      <div className="flex items-center justify-between gap-4 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <p className="text-[11px] text-paper/60 sm:text-xs">
          Pinch or scroll to zoom · drag to pan
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close zoom"
          className={`${control} shrink-0`}
        >
          <X size={20} strokeWidth={2.25} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={attachStage}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          className={`relative min-h-0 flex-1 touch-none select-none overflow-hidden [-webkit-tap-highlight-color:transparent] ${
            zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
          }`}
        >
          <div className="absolute inset-0 grid place-items-center">
            <div
              data-zoom-raster
              style={boxStyle}
              className="overflow-hidden rounded-[10px] bg-paper shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)]"
            >
              {/* Keyed on the source so stepping to the next chart fades it in
                  rather than hard-swapping it. The transform lives on the
                  parent, so the fade cannot fight the zoom. */}
              <div key={src} className="animate-in fade-in h-full w-full">
                <ShieldedImage
                  src={src}
                  alt={alt}
                  className="block h-full w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {onPrev || onNext || positionChip ? (
          <div className="pointer-events-none z-10 flex shrink-0 items-center justify-center gap-3 py-2.5 sm:absolute sm:inset-0 sm:justify-between sm:gap-0 sm:px-4 sm:py-0">
            {onPrev ? (
              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous chart"
                className={navControl}
              >
                <ChevronLeft size={22} strokeWidth={2.5} />
              </button>
            ) : null}
            {positionChip ? (
              // In flow between the arrows on phones; from `sm` up it is
              // absolute inside this `inset-0` row, i.e. the stage's bottom
              // centre, exactly where it has always been.
              <p
                role="status"
                className="pointer-events-none rounded-full bg-ink/70 px-2.5 py-1 text-[11px] tabular-nums text-paper/70 backdrop-blur-sm sm:absolute sm:bottom-3 sm:left-1/2 sm:-translate-x-1/2"
              >
                {positionChip}
              </p>
            ) : null}
            {onNext ? (
              <button
                type="button"
                onClick={onNext}
                aria-label="Next chart"
                className={navControl}
              >
                <ChevronRight size={22} strokeWidth={2.5} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-3 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          onClick={() => zoomTo(view.current.scale / ZOOM_STEP)}
          disabled={!zoomed}
          aria-label="Zoom out"
          className={control}
        >
          <Minus size={18} strokeWidth={2.5} />
        </button>
        <span className="w-14 text-center text-xs tabular-nums text-paper/70">
          {Math.round(applied.scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => zoomTo(view.current.scale * ZOOM_STEP)}
          disabled={applied.scale >= MAX_SCALE - 0.001}
          aria-label="Zoom in"
          className={control}
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
        {zoomed ? (
          <button
            type="button"
            onClick={fitWhole}
            aria-label="Fit the whole chart on screen"
            className="flex min-h-11 items-center justify-center rounded-full bg-paper px-5 text-sm text-ink transition-transform duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Fit
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
