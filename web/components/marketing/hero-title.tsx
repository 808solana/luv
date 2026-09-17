"use client";

import { useState } from "react";

import {
  DepthFlipText,
  type DepthFlipPhrase,
} from "@/components/ui/depth-flip-text";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";

/**
 * Hero title. Two acts, one slot:
 *
 * 1. `luv13` pops in once through `VerticalCutReveal` — the approved reveal,
 *    untouched (chars rise through an `overflow-hidden` clip with a
 *    character-level stagger from the centre and a spring overshoot).
 * 2. The moment that reveal lands, `DepthFlipText` takes the same slot over and
 *    the wordmark itself flips away — through a 3D hinge cut — to the Virgil
 *    Abloh line, holds, flips back, and rests on the mark.
 *
 * The acts are sequential, not layered: the flip mounts only when the pop
 * finishes (`onComplete`), so the pop is never seen sitting under a static copy
 * of itself. Both acts put the mark's ink in the same place — the pop's clip
 * window is `1.2em` inside a `0.9em` line, and the flip's slot is `0.9em` with
 * `1.2em` faces centred in it — so the hand-off moves nothing, and the pills
 * under the title keep measuring from the same line.
 *
 * The wrapper carries only what the two acts share (size, colour, family): the
 * size ladder is also the `em` the flip slot's height is written in.
 */

/**
 * The mark's size ladder, and therefore the flip's slot height too: the slot is
 * `0.9em` of whatever this sets, so this string is the single source of truth
 * for both acts. 56 / 72 / 88px — see `home-hero-gate.md` before changing it.
 */
export const HERO_MARK_SIZE = "text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem]";

const PHRASES: DepthFlipPhrase[] = [
  {
    as: "h1",
    text: "luv13",
    className: "leading-[1.2]",
    // Only a beat: the pop-in has just finished, so this is the pause between
    // the two acts rather than a hold on the mark for its own sake.
    hold: 1.8,
  },
  {
    as: "p",
    /* The closing quote is set off by a NO-BREAK space (U+00A0): the user wanted
       the space-bar gap the type was missing, and U+00A0 is exactly one space
       (0.278em) that cannot become a line-break point — a plain space there
       would have let the closing quote land alone at the end of a line. */
    text: "“Anyone who has a will to create is an artist\u00A0”",
    aside: "Virgil Abloh",
    /* Deliberately **no** `text-balance` / `text-pretty`: the attribution is an
       inline-block atom that trails the sentence, and both of those algorithms
       would rather pull a word down from the sentence ("… is an artist ”")
       than let the atom sit alone on the last line — which is exactly the
       shape we want here (sentence, then the name centred beneath it). */
    className:
      "text-base leading-[1.3] sm:text-2xl md:text-[1.75rem] lg:text-[2rem]",
    hold: 4.4,
  },
];

export function HeroTitle() {
  const [revealed, setRevealed] = useState(false);

  return (
    <div
      className={`text-center font-sans tracking-tight text-paper ${HERO_MARK_SIZE}`}
    >
      {revealed ? (
        /* `loop` — the mark and the quote keep trading places for as long as the
           hero is on screen (the flip pauses itself when it is scrolled away). */
        <DepthFlipText phrases={PHRASES} loop />
      ) : (
        <h1 className="leading-[0.9]">
          <VerticalCutReveal
            splitBy="characters"
            staggerDuration={0.04}
            staggerFrom="center"
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            containerClassName="justify-center leading-[1.2] -my-[0.15em]"
            onComplete={() => setRevealed(true)}
          >
            luv13
          </VerticalCutReveal>
        </h1>
      )}
    </div>
  );
}
