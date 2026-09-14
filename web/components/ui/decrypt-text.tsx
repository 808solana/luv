"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * DecryptText — copy that arrives decoded rather than typed.
 *
 * Adapted for LUV13 from Motiq's DecryptText (MIT), with the design tokens and
 * the `terminal` variant dropped. It is monochrome and inherits `currentColor`,
 * so the same component reads correctly as white-on-red in the hero and as ink
 * on a light section. Visual states live in `globals.css` (`.decrypt-char`), so
 * one component instance does not inject its own <style> block.
 *
 * Every glyph is already boiling at t=0; character *i* locks at
 * `startDelay + i·stagger ± jitter`, so the line resolves in a ragged
 * left-to-right sweep. Server markup and reduced motion render the REAL string
 * (the scramble only ever exists after mount). The glyph layer is `aria-hidden`
 * and the readable string lives in a visually-hidden sibling, so assistive tech
 * never hears the scramble. One rAF loop per instance writes `textContent` and
 * a data attribute only — no layout writes.
 */

export type DecryptTextTrigger = "mount" | "inview" | "hover";

export interface DecryptTextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /** The real string. Rendered readable on the server and to screen readers. */
  text: string;
  /** Scramble pool each unresolved character cycles through. */
  glyphs?: string;
  /** Glyph cycle floor in ms (each char jitters between `speed` and `speed + 35`). */
  speed?: number;
  /** Per-character lock-in stagger in ms. */
  stagger?: number;
  /** Delay before the first character can lock, in ms. */
  startDelay?: number;
  /** Random spread applied to each character's lock time, in ms. */
  jitter?: number;
  /** What starts the first run. */
  trigger?: DecryptTextTrigger;
  /** Re-run automatically this many ms after settling; `false` runs once. */
  loop?: number | false;
  /** Re-scramble on pointer enter (1.5s cooldown). */
  retriggerOnHover?: boolean;
  /** Deterministic seed for the per-character jitter (SSR-stable). */
  seed?: number;
  /** Element tag for the rendered text. */
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
  /** Force the static, resolved state regardless of system preference. */
  reducedMotion?: boolean;
  /** Fires each time the line finishes resolving. */
  onDecrypted?: () => void;
}

interface CharItem {
  /** Index into the flat character list — drives the stagger ramp. */
  i: number;
  ch: string;
}

const POOL = "#%&@$?!*+=/{}[]<>~^";
/** Cooldown before a hover can restart a run (ms). */
const HOVER_COOLDOWN = 1500;
/** Extra ms added to `speed` for the per-char cycle jitter ceiling. */
const CYCLE_SPREAD = 35;

/** mulberry32 — no Math.random at render or module scope (SSR-stable). */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reads synchronously on the client; never rendered into markup. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/** True while the element is on-screen AND the tab is visible. */
function useVisibilityPause<T extends Element>(
  ref: React.RefObject<T | null>,
  { threshold = 0.12 }: { threshold?: number } = {},
): boolean {
  const [onScreen, setOnScreen] = React.useState(true);
  const [tabVisible, setTabVisible] = React.useState(true);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => setOnScreen(entries.some((entry) => entry.isIntersecting)),
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);

  React.useEffect(() => {
    const onVisibility = () =>
      setTabVisible(document.visibilityState !== "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return onScreen && tabVisible;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function DecryptText({
  text,
  glyphs,
  speed = 45,
  stagger = 55,
  startDelay = 350,
  jitter = 120,
  trigger = "inview",
  loop = false,
  retriggerOnHover = false,
  seed = 1,
  as: Tag = "span",
  reducedMotion,
  onDecrypted,
  className,
  ...rest
}: DecryptTextProps) {
  const rootRef = React.useRef<HTMLElement | null>(null);
  const charRefs = React.useRef<Array<HTMLSpanElement | null>>([]);
  const rafRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastStartRef = React.useRef(-Infinity);
  const playedRef = React.useRef(false);
  const settledRef = React.useRef(false);
  const runRef = React.useRef(0);
  const onDecryptedRef = React.useRef(onDecrypted);
  const playRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    onDecryptedRef.current = onDecrypted;
  });

  const systemReduced = useReducedMotion();

  // Effects are client-only, so the live preference is safe to read directly.
  const reduce = reducedMotion ?? systemReduced;

  const visible = useVisibilityPause(rootRef);

  const pool = glyphs && glyphs.length > 0 ? glyphs : POOL;

  // Words keep their glyphs together so the line wraps on word boundaries and
  // the spaces between words are never scrambled into a glyph.
  const words = React.useMemo(() => {
    const out: CharItem[][] = [];
    let i = 0;
    for (const word of text.split(" ")) {
      const item: CharItem[] = [];
      for (const ch of Array.from(word)) {
        item.push({ i, ch });
        i += 1;
      }
      out.push(item);
    }
    return out;
  }, [text]);

  const total = React.useMemo(
    () => words.reduce((count, word) => count + word.length, 0),
    [words],
  );

  const stop = React.useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const resolveAll = React.useCallback(() => {
    for (const el of charRefs.current) {
      if (!el) continue;
      el.textContent = el.dataset.mkChar ?? el.textContent;
      el.dataset.state = "plain";
    }
  }, []);

  const play = React.useCallback(() => {
    const rng = makeRng(seed + runRef.current * 7919);
    runRef.current += 1;
    stop();

    const cells = charRefs.current.filter(
      (el): el is HTMLSpanElement => el !== null,
    );
    if (cells.length === 0) return;

    lastStartRef.current = performance.now();
    playedRef.current = true;
    settledRef.current = false;

    const lockAt = new Float64Array(cells.length);
    const nextAt = new Float64Array(cells.length);
    const locked = new Uint8Array(cells.length);

    cells.forEach((el, index) => {
      lockAt[index] = Math.max(
        0,
        startDelay + index * stagger + (rng() * 2 - 1) * jitter,
      );
      nextAt[index] = 0;
      el.dataset.state = "scramble";
      el.textContent = pool.charAt((rng() * pool.length) | 0);
    });

    let remaining = cells.length;
    const t0 = performance.now();

    const frame = () => {
      const now = performance.now() - t0;
      for (let index = 0; index < cells.length; index += 1) {
        if (locked[index]) continue;
        const el = cells[index];
        if (now >= (lockAt[index] ?? 0)) {
          el.textContent = el.dataset.mkChar ?? "";
          el.dataset.state = "lock";
          locked[index] = 1;
          remaining -= 1;
        } else if (now >= (nextAt[index] ?? 0)) {
          el.textContent = pool.charAt((rng() * pool.length) | 0);
          nextAt[index] = now + speed + rng() * CYCLE_SPREAD;
        }
      }
      if (remaining <= 0) {
        rafRef.current = null;
        settledRef.current = true;
        onDecryptedRef.current?.();
        if (loop !== false && loop > 0) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            playRef.current();
          }, loop);
        }
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }, [jitter, loop, pool, seed, speed, stagger, startDelay, stop]);

  React.useEffect(() => {
    playRef.current = play;
  }, [play]);

  // Orchestration. A one-shot `mount` run is never gated on visibility, so a
  // marquee duplicate that starts off-screen still resolves with the rest.
  // `settledRef` (not `playedRef`) gates the start, because StrictMode's
  // simulated unmount tears the run down and re-runs this effect: a run that
  // was never allowed to finish must be restarted, not skipped.
  useIsomorphicLayoutEffect(() => {
    if (reduce) {
      stop();
      resolveAll();
      settledRef.current = true;
      return;
    }
    if (trigger === "hover") {
      if (!playedRef.current) resolveAll();
      return;
    }
    if (trigger === "inview" && !visible) {
      stop();
      return;
    }
    const idle = rafRef.current == null && timerRef.current == null;
    if (idle && !settledRef.current) {
      play();
      return;
    }
    // Coming back on screen after a completed run: re-arm the loop, don't restart.
    if (loop !== false && loop > 0 && visible && idle) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        play();
      }, Math.min(loop, 3000));
    }
  }, [loop, play, reduce, resolveAll, stop, trigger, visible]);

  React.useEffect(() => stop, [stop]);

  const onPointerEnter = React.useCallback(() => {
    if (reduce || !retriggerOnHover) return;
    if (rafRef.current != null) return;
    if (performance.now() - lastStartRef.current < HOVER_COOLDOWN) return;
    play();
  }, [play, reduce, retriggerOnHover]);

  let cursor = -1;

  return (
    <Tag
      ref={rootRef as React.Ref<never>}
      data-chars={total}
      onPointerEnter={onPointerEnter}
      className={cn("block", className)}
      {...rest}
    >
      <span className="sr-only">{text}</span>
      <span className="block" aria-hidden="true">
        {words.map((word, wordIndex) => (
          <React.Fragment key={wordIndex}>
            <span className="inline-block whitespace-pre">
              {word.map((item) => {
                cursor += 1;
                const at = cursor;
                return (
                  // Each cell is sized by an invisible copy of the REAL glyph, so
                  // substituting scramble symbols never changes the line's width.
                  // Without this, the swap reflows the text: a centered line drifts
                  // sideways and a measured marquee restarts its loop every frame.
                  <span key={item.i} className="relative inline-block">
                    <span className="invisible">{item.ch}</span>
                    <span
                      className="decrypt-char absolute inset-0 select-none"
                      data-mk-char={item.ch}
                      data-state="plain"
                      ref={(el) => {
                        charRefs.current[at] = el;
                      }}
                    >
                      {item.ch}
                    </span>
                  </span>
                );
              })}
            </span>
            {wordIndex < words.length - 1 ? " " : null}
          </React.Fragment>
        ))}
      </span>
    </Tag>
  );
}
