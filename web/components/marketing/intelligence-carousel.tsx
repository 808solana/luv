"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import { ImageZoomOverlay } from "@/components/ui/image-zoom";
import { ShieldedImage } from "@/components/ui/shielded-image";
import { cn } from "@/lib/utils";

/**
 * The Artificial Analysis chart slides, in display order.
 *
 * To add a chart: drop the raster into
 * `web/public/BRAND_ASSETS/intelligence-index/` and add one entry here.
 * Order in this array is the order the carousel steps through — it is the
 * display order, so it does not have to follow the filenames. The images
 * are 2.5× upscales of the supplied 1024×375 exports (see
 * `.cursor/skills/frontend/intelligence-chart.md`) and must keep the
 * 2560×938 ratio — the slide box and the thumbnails both derive from it.
 */
export const INTELLIGENCE_CHART_SLIDES = [
  {
    src: "/BRAND_ASSETS/intelligence-index/02.png",
    alt: "Artificial Analysis Intelligence Index chart, September 2026, showing seven models: GLM-5.3 leads at 45, followed by Grok 4.6 and Kimi K3 at 44, GLM-5.3 Flash at 42 and DeepSeek V4.1 Flash at 40, with Qwen3.8 27B at 34 and DeepSeek V4 Pro at 31 closing the list.",
  },
  {
    src: "/BRAND_ASSETS/intelligence-index/01.png",
    alt: "Artificial Analysis Intelligence Index chart, September 2026. Ten models ranked by index score: Claude Fable 5.1 and GPT-6 Astra lead at 53, followed by Claude Opus 5 at 50 and Muse Spark 1.3 at 47, then GLM-5.3 at 45, Kimi K3 at 44, Gemini 3.8 Flash at 42 and DeepSeek V4.1 Flash at 40; Qwen3.8 27B at 34 and DeepSeek V4 Pro at 31 close the list.",
  },
] as const;

/** Every slide is authored at this ratio; the box, thumbs and viewer use it. */
const SLIDE_RATIO = 2560 / 938;
const SLIDE_RATIO_CLASS = "aspect-[2560/938]";

/**
 * A press that travels further than this (px) was a swipe, not a tap — the
 * drag spring would otherwise open the zoom viewer at the end of every step.
 */
const TAP_SLOP = 8;

const ONE_SECOND = 1000;
const AUTO_DELAY = ONE_SECOND * 5;
const DRAG_BUFFER = 60;

const SPRING_OPTIONS = {
  type: "spring" as const,
  mass: 3,
  stiffness: 400,
  damping: 50,
};

const ACTIVE_SCALE = 1;
const INACTIVE_SCALE = 0.96;

export function IntelligenceCarousel() {
  const slides = INTELLIGENCE_CHART_SLIDES;
  const count = slides.length;

  const [index, setIndex] = useState(0);
  /** Index of the slide open in the zoom viewer, or `null` when it is closed. */
  const [zoomed, setZoomed] = useState<number | null>(null);
  const dragX = useMotionValue(0);
  const reducedMotion = useReducedMotion();

  const frameRef = useRef<HTMLDivElement>(null);
  const hoveringRef = useRef(false);
  const draggingRef = useRef(false);
  const visibleRef = useRef(true);
  /** Where the last press started, to tell a tap from a swipe. */
  const pressRef = useRef({ x: 0, y: 0, moved: false });

  const goTo = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );
  const nudge = useCallback((by: number) => goTo(index + by), [goTo, index]);

  /**
   * Step the chart open in the zoom viewer — and the track behind it, so
   * closing the viewer leaves the visitor on the chart they were looking at.
   * Circular, like `goTo`: the viewer is a loop, not a dead end.
   */
  const stepZoom = useCallback(
    (by: number) => {
      if (zoomed === null) return;
      const next = (((zoomed + by) % count) + count) % count;
      setZoomed(next);
      setIndex(next);
    },
    [count, zoomed],
  );

  // Auto-advance. Re-armed on every index change so a manual step always gets
  // the full dwell, and skipped while the pointer is over the frame, mid-drag,
  // off-screen, open in the zoom viewer, or when the visitor asked for reduced
  // motion.
  useEffect(() => {
    if (reducedMotion || count < 2) return;

    const interval = setInterval(() => {
      if (
        Math.abs(dragX.get()) > 0.5 ||
        hoveringRef.current ||
        draggingRef.current ||
        zoomed !== null
      ) {
        return;
      }
      if (!visibleRef.current) return;
      setIndex((prev) => (prev + 1) % count);
    }, AUTO_DELAY);

    return () => clearInterval(interval);
  }, [count, dragX, index, reducedMotion, zoomed]);

  // Only spin while the frame is actually on screen.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.2 },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const onDragStart = () => {
    draggingRef.current = true;
  };

  // The track is locked to a single point (`dragConstraints` 0/0), so the drag
  // is a rubber band that always springs back to 0 and the `animate`
  // translateX stays in charge of the resting position. That also means
  // `dragX` only ever holds `elastic × pointer offset`, so the step decision
  // has to come from the raw pan offset in `info`, not from the motion value.
  const onDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    draggingRef.current = false;
    const x = info.offset.x;

    if (x <= -DRAG_BUFFER) nudge(1);
    else if (x >= DRAG_BUFFER) nudge(-1);
  };

  const transition = reducedMotion ? { duration: 0 } : SPRING_OPTIONS;

  // A `<button>` over the slide is the zoom affordance. It has to coexist with
  // the track's drag, so a press is remembered and any travel past `TAP_SLOP`
  // disqualifies it: sweeping the carousel never opens the viewer.
  const openZoom = (slide: number) => {
    if (pressRef.current.moved) return;
    setZoomed(slide);
  };

  return (
    <>
      <div
        ref={frameRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Artificial Analysis Intelligence Index charts"
        tabIndex={0}
        onPointerDown={(event) => {
          pressRef.current = {
            x: event.clientX,
            y: event.clientY,
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          const press = pressRef.current;
          if (press.moved) return;
          if (
            Math.hypot(event.clientX - press.x, event.clientY - press.y) >
            TAP_SLOP
          ) {
            press.moved = true;
          }
        }}
        onMouseEnter={() => {
          hoveringRef.current = true;
        }}
        onMouseLeave={() => {
          hoveringRef.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            nudge(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            nudge(1);
          }
        }}
        className="relative overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-[0_1px_2px_rgba(13,12,18,0.04),0_20px_48px_-28px_rgba(13,12,18,0.35)] outline-none focus-visible:ring-2 focus-visible:ring-black/20"
      >
        <div className="relative overflow-hidden p-2 sm:p-4">
          <motion.div
            drag={reducedMotion ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.35}
            dragMomentum={false}
            style={{ x: dragX }}
            animate={{ translateX: `-${index * 100}%` }}
            transition={transition}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="flex cursor-grab active:cursor-grabbing"
          >
            {slides.map((slide, i) => (
              <motion.div
                key={slide.src}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                aria-hidden={i !== index ? true : undefined}
                animate={{
                  scale: i === index ? ACTIVE_SCALE : INACTIVE_SCALE,
                }}
                transition={transition}
                className="relative w-full shrink-0"
              >
                <ShieldedImage
                  src={slide.src}
                  alt={slide.alt}
                  className={cn(
                    "pointer-events-none block w-full",
                    SLIDE_RATIO_CLASS,
                  )}
                />
                {i === index ? (
                  <button
                    type="button"
                    onClick={() => openZoom(i)}
                    aria-label={`Zoom into chart ${i + 1} of ${count}`}
                    className="absolute inset-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                  />
                ) : null}
              </motion.div>
            ))}
          </motion.div>
        </div>

        {count > 1 ? (
          <div className="flex items-center justify-center gap-2.5 border-t border-black/5 px-4 py-3 sm:gap-3 sm:py-3.5">
            {slides.map((slide, i) => (
              <button
                key={slide.src}
                type="button"
                aria-label={`Show chart ${i + 1} of ${count}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => goTo(i)}
                className={cn(
                  "relative w-16 shrink-0 overflow-hidden rounded-md border bg-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 sm:w-24",
                  i === index
                    ? "border-black/70 opacity-100"
                    : "border-black/10 opacity-50 hover:opacity-90",
                )}
              >
                <ShieldedImage
                  src={slide.src}
                  alt=""
                  className={cn("block w-full", SLIDE_RATIO_CLASS)}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {zoomed !== null ? (
        <ImageZoomOverlay
          src={slides[zoomed].src}
          alt={slides[zoomed].alt}
          ratio={SLIDE_RATIO}
          label={`Artificial Analysis chart ${zoomed + 1} of ${count}, zoomed`}
          position={{ index: zoomed + 1, total: count }}
          onPrev={count > 1 ? () => stepZoom(-1) : undefined}
          onNext={count > 1 ? () => stepZoom(1) : undefined}
          onClose={() => setZoomed(null)}
        />
      ) : null}
    </>
  );
}
