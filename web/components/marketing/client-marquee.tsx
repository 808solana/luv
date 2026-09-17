"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { CLIENT_PROVIDERS, type ClientProvider } from "@/lib/client-providers";
import { ShieldedImage } from "@/components/ui/shielded-image";

/**
 * The track repeats the client list 3× because the travel is endless: the row's
 * position is folded back into one *period* (`offset` and `offset ± period`
 * paint the same marks, which is what makes the loop seamless), and three
 * copies keep the runway wider than the window at every width we support.
 *
 * Copies 2 and 3 are `aria-hidden` + `tabIndex={-1}` so each client is
 * announced once and the tab order stays at one stop per client — but they are
 * **not** `inert`. `inert` also blocks pointer events, and since the duplicates
 * occupy most of the viewport for most of the loop that made the majority of
 * the visible row silently unclickable (reported 2026-09-15: "when I click on
 * Cursor, it doesn't open the app"). Every card on screen has to be a real
 * link; only the a11y tree and the tab order are deduplicated.
 *
 * `pr` in the track equals its flex `gap`: with it the track is exactly
 * `copies × (items + gaps)` wide, so copy 2 begins exactly one period after
 * copy 1. The loop still *measures* that period off the DOM rather than
 * assuming it.
 */
const COPIES = 3;

/**
 * How long the row holds the position a swipe left it in, before the auto
 * travel picks up again (ms). The user, 2026-09-16: *"the moment I lift my
 * fingers, there will be a grace period of about 1 second where it will stay
 * exactly where the user left off, and then it will continue the spinning
 * effect forever until the next scroll"*.
 */
const RESUME_DELAY_MS = 1000;

/**
 * Finger travel (px) that separates a drag from a tap. Under it the press is
 * still a press on a card and the row never stops; over it the gesture owns the
 * position, and the `click` it ends with is swallowed so a swipe can never open
 * a link mid-flick. 8px is the same tap gate `image-zoom.tsx` uses.
 */
const DRAG_SLOP_PX = 8;

/** Fold travel back into one period. The track is 3 periods wide. */
function wrap(offset: number, period: number) {
  return ((offset % period) + period) % period;
}

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function ClientCard({
  provider,
  decorative,
}: {
  provider: ClientProvider;
  decorative: boolean;
}) {
  return (
    <a
      href={provider.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${provider.name} on OpenRouter`}
      data-decorative={decorative ? "true" : undefined}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      className="flex w-[29.4vw] shrink-0 snap-center flex-col items-center rounded-[20px] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#fff,0_0_0_5px_#0d0c12] sm:w-[9.1rem] lg:w-[10.5rem]"
    >
      <ShieldedImage
        src={provider.src}
        alt=""
        className="aspect-square w-full"
      />
      <span className="mt-4 text-center text-[15px] font-semibold tracking-tight text-black">
        {provider.name}
      </span>
    </a>
  );
}

/** Full-bleed auto-scrolling row of client marks + names. */
export function ClientMarquee() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [focusInRow, setFocusInRow] = useState(false);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  /** A finger owns the row, or the post-swipe hold is counting down. */
  const [held, setHeld] = useState(false);

  // ── travel ───────────────────────────────────────────────────────────────
  // `offset` is px of travel into one period, and the single source of truth
  // for where the row is; every frame paints it as one `translate3d`.
  //
  // This used to be a CSS keyframe (cheaper — the compositor owned it). A swipe
  // has to *hold* the position, drag it backwards past the period, and then
  // hand a fractional phase back to the auto travel, and an animation's phase
  // can only be re-seeded through `animation-delay` — mid-flight that is a
  // restart in some engines and a shift in others, so the row can jump on
  // release. One owner for the transform cannot jump. The loop only exists
  // while the row is on screen and the tab is visible, so an idle page still
  // pays nothing per frame.
  const offsetRef = useRef(0);
  const periodRef = useRef(0);
  const speedRef = useRef(0); // px/s
  const draggingRef = useRef(false);
  const resumeAtRef = useRef(0); // auto travel stays held until this stamp
  const suppressClickRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paint = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transform = `translate3d(${-offsetRef.current}px,0,0)`;
  }, []);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const cards = track?.children;
    if (!track || !cards || cards.length < CLIENT_PROVIDERS.length + 1) return;
    // The repeat distance between copy 1's first card and copy 2's — the true
    // period, read from layout instead of assumed from the track's width.
    // `getBoundingClientRect` (not `offsetLeft`) because the pitch is fractional
    // below `sm` — 110.25 + 16 — and a whole-pixel period would put a half-pixel
    // step in the loop seam.
    const period =
      cards[CLIENT_PROVIDERS.length].getBoundingClientRect().left -
      cards[0].getBoundingClientRect().left;
    if (!(period > 0)) return;
    periodRef.current = period;
    // Travel speed is whatever `--client-marquee-duration` was tuned to (see
    // globals.css): the per-breakpoint durations hold ~51px/s as the cards
    // grow. Deriving px/s from it keeps that one knob authoritative rather
    // than copying the numbers into JS where they can drift.
    const duration = parseFloat(
      getComputedStyle(track).getPropertyValue("--client-marquee-duration"),
    );
    if (Number.isFinite(duration) && duration > 0) {
      speedRef.current = period / duration;
    }
    offsetRef.current = wrap(offsetRef.current, period);
    paint();
  }, [paint]);

  const startHold = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    setHeld(true);
  }, []);

  const holdThenResume = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    resumeAtRef.current = performance.now() + RESUME_DELAY_MS;
    setHeld(true);
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      setHeld(false);
    }, RESUME_DELAY_MS);
  }, []);

  // An always-running animation that keeps ticking while the section is
  // off-screen steals frames from scroll on phones (smooth-scroll-fx.md #6).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? true),
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // The row holds still only for **keyboard** users, who need the card they
  // have tabbed to not slide out from under them. Pointer focus must NOT pause
  // it: clicking a card focuses its `<a>` in Chrome/Firefox, and that used to
  // freeze the row until the user clicked elsewhere to blur it — reported
  // 2026-09-15 ("when I click on, let's say, Claude, I get opened in a new tab,
  // although then everything stops. The sliding just stops. I have to reclick
  // the website, and then it unstops").
  //
  // Input modality is tracked explicitly instead of leaning on `:focus-visible`
  // or `:focus-within` in CSS, because the `:focus-visible` heuristic depends on
  // the input source and the engine, and `:focus-within` cannot tell a click
  // from a Tab at all. Order is reliable: `pointerdown` fires *before* the focus
  // it causes, and `keydown` fires before the focus a Tab moves.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onPointerDown = () => setKeyboardNav(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") setKeyboardNav(true);
    };
    const onFocusIn = () => setFocusInRow(true);
    const onFocusOut = (event: FocusEvent) => {
      // Moving between two cards keeps focus inside the row; only a focus
      // destination outside it ends the hold.
      const next = event.relatedTarget as Node | null;
      if (!next || !el.contains(next)) setFocusInRow(false);
    };
    // Document-level, so the modality is current even when the last press
    // landed somewhere outside the row (e.g. tab in, click the email field,
    // then click a card).
    document.addEventListener("pointerdown", onPointerDown, true);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // The period is `cards × (width + gap)`, so it moves with the breakpoint,
  // the fonts, and any future card resize — everything that changes the track's
  // own box, which is what the observer watches.
  useIsoLayoutEffect(() => {
    measure();
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [measure]);

  // Reduced motion means no travel at all: the loop below is gated off and the
  // row collapses to a native scroll-snap scroller (globals.css). Any transform
  // we already painted has to go explicitly — an inline style outranks the
  // stylesheet's `transform: none`, and a stray one would break the scroller.
  // A hold that happens to be counting down is left alone: it expires on its own
  // within `RESUME_DELAY_MS`, and the drag effect's teardown ends a live swipe.
  useEffect(() => {
    if (!reduceMotion) return;
    offsetRef.current = 0;
    draggingRef.current = false;
    const track = trackRef.current;
    if (track) track.style.transform = "";
  }, [reduceMotion]);

  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    },
    [],
  );

  const keyboardHold = focusInRow && keyboardNav;
  const running = onScreen && tabVisible && !reduceMotion;

  // The auto travel. `draggingRef` and `resumeAtRef` are reads of the gesture
  // rather than state, so a swipe never re-renders React sixty times.
  useEffect(() => {
    if (!running || keyboardHold) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // A throttled or backgrounded gap must not teleport the row.
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      if (draggingRef.current || now < resumeAtRef.current) return;
      const period = periodRef.current;
      if (!period) return;
      offsetRef.current = wrap(
        offsetRef.current + speedRef.current * dt,
        period,
      );
      paint();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [keyboardHold, paint, running]);

  // The swipe. The whole row is the handle: a finger on a mark scrubs the list
  // in either direction, and the moment it lifts the row holds its position for
  // `RESUME_DELAY_MS` before the travel resumes from exactly there.
  useEffect(() => {
    if (reduceMotion) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    let grab: { id: number; x: number; offset: number; live: boolean } | null =
      null;

    function onMove(event: PointerEvent) {
      if (!grab || event.pointerId !== grab.id) return;
      if (!grab.live) {
        const dx = event.clientX - grab.x;
        if (Math.abs(dx) < DRAG_SLOP_PX) return;
        // The gesture only takes the position once the finger clears the slop
        // — a press that never moves is a press on a card, and the row must
        // keep running under the cursor (2026-09-15: "the sliding doesn't
        // stop… I want it to continue forever"). The anchor moves to the point
        // where travel begins, so the slop is *subtracted* (native-scroll
        // behaviour) instead of replayed as a jump, and a drag that arrives as
        // a single big move still carries the whole distance.
        grab.x += Math.sign(dx) * DRAG_SLOP_PX;
        grab.offset = offsetRef.current;
        grab.live = true;
        draggingRef.current = true;
        startHold();
      }
      const period = periodRef.current;
      if (!period) return;
      // Finger and marks move together, both ways: dragging left travels the
      // row forward, the same direction it already spins.
      offsetRef.current = wrap(grab.offset - (event.clientX - grab.x), period);
      paint();
    }

    function finish(event: PointerEvent) {
      if (!grab || event.pointerId !== grab.id) return;
      const live = grab.live;
      grab = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (!live) return;
      draggingRef.current = false;
      // The gesture ended in travel, so the click it may be part of is a swipe,
      // not a tap: swallow it rather than open whatever card is under the
      // finger.
      suppressClickRef.current = true;
      holdThenResume();
    }

    function onDown(event: PointerEvent) {
      if (grab || (event.pointerType === "mouse" && event.button !== 0)) return;
      // Every press re-arms the tap gate, so a suppressed click can never
      // outlive the gesture that set it.
      suppressClickRef.current = false;
      grab = { id: event.pointerId, x: event.clientX, offset: 0, live: false };
      // Tracked on `window`, not on the row: a swipe that runs off the end of
      // the row has to keep following the finger. Deliberately **not**
      // `setPointerCapture` — that re-targets the pointerup (and the click the
      // browser derives from it) to the capturing element, and these cards are
      // links, so taps would stop opening.
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    }

    function onClick(event: MouseEvent) {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }

    viewport.addEventListener("pointerdown", onDown);
    viewport.addEventListener("click", onClick, true);
    return () => {
      viewport.removeEventListener("pointerdown", onDown);
      viewport.removeEventListener("click", onClick, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      // This only tears down on unmount or when reduced motion lands. A swipe
      // still in flight must not leave the hold latched, or the row would come
      // back frozen with no timer left to release it.
      if (grab?.live) {
        grab = null;
        draggingRef.current = false;
        setHeld(false);
      }
    };
  }, [holdThenResume, paint, reduceMotion, startHold]);

  const paused = !running || keyboardHold || held;

  return (
    <div className="relative w-full">
      <div ref={viewportRef} className="client-marquee-viewport w-full">
        <div
          ref={trackRef}
          className="client-marquee flex w-max items-start gap-4 pr-4 sm:gap-6 sm:pr-6"
          data-paused={paused ? "true" : "false"}
        >
          {Array.from({ length: COPIES }, (_, copy) =>
            CLIENT_PROVIDERS.map((provider) => (
              <ClientCard
                key={`${copy}-${provider.id}`}
                provider={provider}
                decorative={copy > 0}
              />
            )),
          )}
        </div>
      </div>

      {/* Edge fades, so the row reads as endless instead of cut off. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-white to-transparent sm:w-24"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-white to-transparent sm:w-24"
      />
    </div>
  );
}
