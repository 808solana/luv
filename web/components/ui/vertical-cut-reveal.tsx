"use client";

import * as React from "react";
import { motion, useReducedMotion, type Transition } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * VerticalCutReveal — text climbs up through an invisible cut and pops into place.
 *
 * Every word is an `overflow-hidden` clip window; each glyph sits below the
 * window's bottom edge and slides up to `y: 0`. The clip is the "cut": glyphs
 * emerge through the word's own edge, so a spring with a little overshoot reads
 * as a soft pop. `staggerFrom="center"` fans the wave out from the middle.
 *
 * Adapted from Cnippet's `VerticalCutReveal` (MIT). LUV13 changes:
 * - `framer-motion` rather than `motion/react` — the rest of the marketing UI
 *   already imports from `framer-motion`, so this keeps one motion runtime.
 * - No `autoStart` state machine, ref API, or `isAnimating` effect: rendering
 *   `initial` + `animate` lets Motion start the reveal on mount itself. Less
 *   state, and no `setState` in an effect body.
 * - The reveal is instant and unstaggered under `prefers-reduced-motion`.
 * - The real string is an `sr-only` sibling and the glyph layer is
 *   `aria-hidden`, so assistive tech and crawlers read plain text.
 *
 * Word boundaries are always preserved: characters stay inside their word's
 * clip window, so a word can never wrap mid-word.
 */

export type VerticalCutRevealStagger =
  | "first"
  | "last"
  | "center"
  | "random"
  | number;

export interface VerticalCutRevealProps {
  /** The string to reveal. */
  children: string;
  /** Slide down from above instead of up from below. */
  reverse?: boolean;
  /** Motion transition for each segment. A spring gives the pop. */
  transition?: Transition;
  /** Granularity of the split. Any other string is used as a delimiter. */
  splitBy?: "words" | "characters" | "lines" | (string & {});
  /** Seconds between each segment's reveal. */
  staggerDuration?: number;
  /** Where the stagger wave starts. A number counts from that index. */
  staggerFrom?: VerticalCutRevealStagger;
  /** Class on the flex root. */
  containerClassName?: string;
  /** Class on each word's `overflow-hidden` clip window. */
  wordLevelClassName?: string;
  /** Class on each character wrapper (inside the clip). */
  elementLevelClassName?: string;
  /** Extra class on the flex root. */
  className?: string;
  /** Fires when the last segment finishes. */
  onComplete?: () => void;
}

interface Word {
  characters: string[];
  needsSpace: boolean;
}

/** Grapheme-safe split so emoji and combined marks stay one segment. */
function splitGraphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }
  return Array.from(text);
}

/** Deterministic pseudo-random in [0, 1) — keeps "random" SSR-stable. */
function hashUnit(value: number): number {
  let x = Math.imul(value + 1, 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822507) >>> 0;
  x ^= x >>> 13;
  return x / 4294967296;
}

export function VerticalCutReveal({
  children,
  reverse = false,
  transition = { type: "spring", stiffness: 300, damping: 20 },
  splitBy = "words",
  staggerDuration = 0.2,
  staggerFrom = "first",
  containerClassName,
  wordLevelClassName,
  elementLevelClassName,
  className,
  onComplete,
}: VerticalCutRevealProps) {
  const text = children ?? "";
  const reduced = useReducedMotion() ?? false;

  const words = React.useMemo<Word[]>(() => {
    const chunks = text.split(" ");
    if (splitBy === "characters") {
      return chunks.map((word, i) => ({
        characters: splitGraphemes(word),
        needsSpace: i !== chunks.length - 1,
      }));
    }
    const segments =
      splitBy === "words"
        ? chunks
        : splitBy === "lines"
          ? text.split("\n")
          : text.split(splitBy);
    return segments.map((segment, i) => ({
      characters: [segment],
      needsSpace: i !== segments.length - 1,
    }));
  }, [text, splitBy]);

  // Total characters (spaces included) — the length the stagger wave spans.
  const total = React.useMemo(
    () =>
      words.reduce(
        (sum, word) => sum + word.characters.length + (word.needsSpace ? 1 : 0),
        0,
      ),
    [words],
  );

  // Flat character index at which each word begins (canonical counts characters,
  // not spaces, for the stagger ramp).
  const wordStarts = React.useMemo(() => {
    const starts: number[] = [];
    let count = 0;
    for (const word of words) {
      starts.push(count);
      count += word.characters.length;
    }
    return starts;
  }, [words]);

  const delayFor = React.useCallback(
    (index: number) => {
      if (reduced) return 0;
      if (staggerFrom === "first") return index * staggerDuration;
      if (staggerFrom === "last") return (total - 1 - index) * staggerDuration;
      if (staggerFrom === "center")
        return Math.abs(Math.floor(total / 2) - index) * staggerDuration;
      if (staggerFrom === "random")
        return Math.abs(Math.floor(hashUnit(index) * total) - index) * staggerDuration;
      return Math.abs(staggerFrom - index) * staggerDuration;
    },
    [reduced, staggerDuration, staggerFrom, total],
  );

  const baseDelay =
    !reduced && typeof transition.delay === "number" ? transition.delay : 0;
  const resolvedTransition: Transition = reduced ? { duration: 0 } : transition;
  const distance = reverse ? "-100%" : "100%";

  return (
    <span
      className={cn(
        "flex flex-wrap whitespace-pre-wrap",
        splitBy === "lines" && "flex-col",
        className,
        containerClassName,
      )}
    >
      <span className="sr-only">{text}</span>
      {words.map((word, wordIndex) => (
        <span
          key={wordIndex}
          aria-hidden="true"
          className={cn("inline-flex overflow-hidden", wordLevelClassName)}
        >
          {word.characters.map((char, charIndex) => {
            const index = (wordStarts[wordIndex] ?? 0) + charIndex;
            const isLast =
              wordIndex === words.length - 1 &&
              charIndex === word.characters.length - 1;
            return (
              <span
                key={charIndex}
                className={cn(
                  "relative whitespace-pre-wrap",
                  elementLevelClassName,
                )}
              >
                <motion.span
                  className="inline-block"
                  initial={{ y: distance }}
                  animate={{ y: 0 }}
                  transition={{
                    ...resolvedTransition,
                    delay: baseDelay + delayFor(index),
                  }}
                  onAnimationComplete={isLast ? onComplete : undefined}
                >
                  {char}
                </motion.span>
              </span>
            );
          })}
          {word.needsSpace ? <span>{" "}</span> : null}
        </span>
      ))}
    </span>
  );
}
