"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Ref } from "react";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

/**
 * DepthFlipText — a line of text tumbles away through a 3D hinge and the next
 * line tumbles in behind it.
 *
 * Every character is an `inline-block` box that rotates about an axis **half a
 * line box behind the glyph**, so at `rotationX: 0` the transform resolves to
 * plain identity: both faces start and end exactly on their own layout box, and
 * nothing shifts by a pixel while the flip runs. Words stay wrapped in
 * `inline-block` spans, so a word can never break mid-word.
 *
 * Adapted from Hyperiux Vault's `DepthFlipText` (MIT-ish demo). LUV13 changes —
 * the mechanic is theirs, the implementation is ours:
 * - **React does the splitting, not `SplitText`.** The character boxes are real
 *   elements in the tree, so the text is in the SSR HTML, there is no
 *   split/revert churn between cycles, and no fonts-ready gate is needed (the
 *   boxes already hold the final glyphs).
 * - **No `ScrollTrigger` / scrub / full-screen wrapper.** It is a text slot, not
 *   a section: it takes the size it is given and owns two things — the flip and
 *   the hold between flips. The hero drives it.
 * - **A fixed-height slot**, so the phrases can differ wildly in size (an 88px
 *   wordmark and a 28px sentence, say) without the page moving under them.
 * - **Phrases carry their own tag, type and hold** — the wordmark is the `h1`,
 *   the sentence is a `p`, and each one decides how long it sits still.
 * - **The attribution sits to the right of the text**, on the same baseline, not
 *   on a line of its own (it wraps under as one unbreakable unit when the line
 *   is too narrow to hold it).
 * - Words fall back to a plain `opacity` crossfade under
 *   `prefers-reduced-motion` (no rotation, no stagger).
 *
 * The first phrase holds still on mount, the flip runs, the second phrase holds,
 * and then it either rests on the first phrase (`loop` off) or keeps cycling
 * (`loop` on). Either way the cycle is paused while the slot is off screen, so
 * the hero is never animating to an empty room.
 * `prefers-reduced-motion` and `loop` are the two knobs that matter.
 */

/** How far a character's hinge sits behind the glyph, in silhouette. */
const CHAR_PERSPECTIVE = 1200;

/** A heavy in-out so the face is edge-on for as little time as possible. */
const FLIP_EASE = "power4.inOut";

/** Reduced-motion crossfade length, in seconds. */
const REDUCED_FADE = 0.5;

/** Seconds a phrase sits still when it does not name its own `hold`. */
const DEFAULT_HOLD = 3;

export interface DepthFlipPhrase {
  /** The line that flips. Characters are split for you — pass plain text. */
  text: string;
  /**
   * Optional shorter fragment to the right of the text at `0.6em` — an
   * attribution, a source, a date. It is prefixed with an em dash and kept on
   * one line, so it wraps under the text as a unit rather than mid-name.
   */
  aside?: string;
  /** Element this phrase renders as. Usually the wordmark is the `h1`. */
  as?: "h1" | "h2" | "p" | "div" | "span";
  /** Utilities for this phrase's own line — type scale, tracking, colour. */
  className?: string;
  /** Seconds this phrase holds before the next flip starts. */
  hold?: number;
}

export interface DepthFlipTextProps {
  /** Lines to cycle, in order. */
  phrases: DepthFlipPhrase[];
  /** Seconds one character takes to travel through the cut. */
  transitionDuration?: number;
  /** Seconds between characters, so the flip travels across the line. */
  charStagger?: number;
  /**
   * Keep cycling after the last phrase instead of resting on the first. The
   * cycle pauses while the slot is off screen either way.
   */
  loop?: boolean;
  /** Extra utilities for the slot — the height is the caller's to set. */
  className?: string;
}

interface Segment {
  graphemes: string[];
  space: boolean;
}

interface FlipLayerProps {
  ref?: Ref<HTMLDivElement>;
  phrase: DepthFlipPhrase;
  /** The incoming face paints nothing until GSAP rotates it in. */
  hidden?: boolean;
}

/** Deterministic split so server and client agree on the character boxes. */
function splitGraphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
}

function splitWords(text: string): Segment[] {
  const words = text.split(" ");
  return words.map((word, index) => ({
    graphemes: splitGraphemes(word),
    space: index < words.length - 1,
  }));
}

/**
 * One line, split to the character. Every glyph is a `[data-flip-char]` box —
 * that attribute is the only contract with the timeline.
 */
function FlipLine({ text }: { text: string }) {
  const words = useMemo(() => splitWords(text), [text]);

  return (
    <Fragment>
      {words.map((word, wordIndex) => (
        <Fragment key={wordIndex}>
          <span className="inline-block whitespace-pre-wrap">
            {word.graphemes.map((grapheme, index) => (
              <span
                key={index}
                data-flip-char
                className="inline-block whitespace-pre-wrap"
              >
                {grapheme}
              </span>
            ))}
          </span>
          {word.space ? " " : null}
        </Fragment>
      ))}
    </Fragment>
  );
}

function FlipLayer({ ref, phrase, hidden = false }: FlipLayerProps) {
  const Tag = phrase.as ?? "p";
  const accessible = phrase.aside
    ? `${phrase.text} — ${phrase.aside}`
    : phrase.text;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute inset-0 flex items-center justify-center",
        hidden && "opacity-0",
      )}
    >
      <Tag
        className={cn(
          "w-full text-center leading-[1.2] whitespace-pre-wrap",
          phrase.className,
        )}
      >
        {/* The readable line is always in the document; the glyph boxes are the
            animation, so they are hidden from assistive tech. */}
        <span className="sr-only">{accessible}</span>
        <span aria-hidden="true">
          <FlipLine text={phrase.text} />
          {phrase.aside ? (
            /* A real space, then an inline-block + nowrap attribution. The
               space gives the line somewhere to break and keeps copy/paste
               reading exactly like the a11y string; `nowrap` keeps the em dash
               and the name together, so the whole thing either trails the text
               on one baseline or drops to the next line whole. The em dash is
               drawn here rather than passed in, so the ink matches the a11y
               string. 0.55em (not 0.6) is what buys the one-line fit at wider
               widths, and `tracking-widest` is emphatically **not** optional:
               the phrase inherits the hero's `tracking-tight` (-0.025em), which
               is what made the name read as jammed together — the aside is the
               one place in the hero that is set open. See `depth-flip-text.md`
               before changing any of these three numbers. */
            <>
              {" "}
              <span
                data-flip-aside
                className="inline-block text-[0.55em] tracking-widest whitespace-nowrap opacity-80"
              >
                <FlipLine text={`— ${phrase.aside}`} />
              </span>
            </>
          ) : null}
        </span>
      </Tag>
    </div>
  );
}

export function DepthFlipText({
  phrases,
  transitionDuration = 1.15,
  charStagger = 0.012,
  loop = false,
  className,
}: DepthFlipTextProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  const slotRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  /** Whatever timeline is currently running, so it can be paused off-screen. */
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  /** Whether the slot is on screen right now. */
  const onScreenRef = useRef(true);

  const count = phrases.length;
  const identity = useMemo(
    () =>
      phrases.map((phrase) => `${phrase.text}|${phrase.aside ?? ""}`).join("~"),
    [phrases],
  );

  const nextIndex = (activeIndex + 1) % Math.max(count, 1);
  const current = phrases[activeIndex];
  const next = phrases[nextIndex];
  const hasNext = count > 1;

  // Wrapping past the last phrase ends the run when `loop` is off — land back on
  // the first phrase and leave it at rest. With `loop` on, `nextIndex` wrapping
  // to 0 is just the next cycle.
  const advance = useCallback(() => {
    if (!loop && nextIndex === 0) setFinished(true);
    setActiveIndex(nextIndex);
  }, [loop, nextIndex]);

  useGSAP(
    () => {
      const currentLayer = currentRef.current;
      const nextLayer = nextRef.current;
      if (
        !current ||
        !next ||
        !hasNext ||
        finished ||
        !currentLayer ||
        !nextLayer
      )
        return;

      const currentChars = gsap.utils.toArray<HTMLElement>(
        currentLayer.querySelectorAll("[data-flip-char]"),
      );
      const nextChars = gsap.utils.toArray<HTMLElement>(
        nextLayer.querySelectorAll("[data-flip-char]"),
      );
      if (!currentChars.length || !nextChars.length) return;

      // Nothing to pause: this cycle's timeline is the only one that counts.
      timelineRef.current = null;

      // The rotation (or crossfade) rides on the characters, never on the layer
      // itself — an opacity below 1 on the layer would flatten its 3D children.
      gsap.set([currentLayer, nextLayer], { opacity: 1 });

      const hold = current.hold ?? DEFAULT_HOLD;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      // Hand every cycle to the same "run it unless the hero is off-screen"
      // path, so `loop` cannot keep animating behind the user's back.
      const run = (build: (tl: gsap.core.Timeline) => void) => {
        const tl = gsap.timeline({ delay: hold, onComplete: advance });
        build(tl);
        timelineRef.current = tl;
        if (!onScreenRef.current) tl.pause();
      };

      if (reduced) {
        gsap.set(nextChars, { opacity: 0 });
        run((tl) =>
          tl
            .to(
              currentChars,
              { opacity: 0, duration: REDUCED_FADE, ease: "power2.out" },
              0,
            )
            .to(
              nextChars,
              { opacity: 1, duration: REDUCED_FADE, ease: "power2.out" },
              0,
            ),
        );
        return;
      }

      // Rotating about an axis half a line box BEHIND the glyph is what kills
      // the shift: at rotationX 0 the transform resolves to plain identity, so
      // the outgoing face starts, and the incoming face ends, exactly on their
      // own layout box. Measured per character in px because GSAP reads the
      // z-origin of `transformOrigin` with a bare parseFloat.
      gsap.set([...currentChars, ...nextChars], {
        transformPerspective: CHAR_PERSPECTIVE,
        backfaceVisibility: "hidden",
        force3D: true,
      });
      currentChars.forEach((char) =>
        gsap.set(char, {
          transformOrigin: `50% 50% ${-(char.offsetHeight / 2)}px`,
          rotationX: 0,
          opacity: 1,
        }),
      );
      nextChars.forEach((char) =>
        gsap.set(char, {
          transformOrigin: `50% 50% ${-(char.offsetHeight / 2)}px`,
          rotationX: -90,
          opacity: 1,
        }),
      );

      run((tl) =>
        tl
          .to(
            currentChars,
            {
              rotationX: 90,
              duration: transitionDuration,
              ease: FLIP_EASE,
              stagger: charStagger,
            },
            0,
          )
          .to(
            nextChars,
            {
              rotationX: 0,
              duration: transitionDuration,
              ease: FLIP_EASE,
              stagger: charStagger,
            },
            0,
          ),
      );
    },
    {
      scope: slotRef,
      // Each cycle re-mounts the two layers, so the previous cycle's inline
      // styles have to be reverted rather than accumulated.
      revertOnUpdate: true,
      dependencies: [
        activeIndex,
        finished,
        hasNext,
        identity,
        transitionDuration,
        charStagger,
      ],
    },
  );

  // A looping title should only animate while the title is actually on screen.
  // This pauses a cycle mid-flip rather than skipping it, so nothing snaps when
  // the hero comes back into view.
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreenRef.current = entry.isIntersecting;
        const tl = timelineRef.current;
        if (!tl) return;
        // Only ever resume a cycle that has not finished — `play()` on a
        // completed timeline would restart it on top of the next cycle.
        if (entry.isIntersecting) {
          if (tl.progress() < 1) tl.play();
        } else {
          tl.pause();
        }
      },
      { threshold: 0 },
    );

    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  if (!count) return null;

  return (
    <div ref={slotRef} className={cn("relative h-[0.9em]", className)}>
      {/* Keyed by role, not by phrase: a fresh pair of layers each cycle is what
          keeps the incoming face hidden (its `hidden` class) until GSAP turns
          it, and keeps the resting face free of leftover inline transforms. */}
      <FlipLayer
        key={`current-${activeIndex}`}
        ref={currentRef}
        phrase={current}
      />
      {hasNext ? (
        <FlipLayer
          key={`next-${nextIndex}`}
          ref={nextRef}
          phrase={next}
          hidden
        />
      ) : null}
    </div>
  );
}

export default DepthFlipText;
