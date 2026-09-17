---
name: decrypt-text
description: Archived 2026-09-14. The hero mark no longer scrambles; it pops in via VerticalCutReveal. Kept for the width-stable-cell and StrictMode lessons if a scramble effect is ever wanted again.
created: 2026-09-13
updated: 2026-09-14
status: stale
tags: [frontend, motion, animation, typography, hero, accessibility, archive]
---

# DecryptText (archived)

The `luv13` hero mark took this glyph-scramble entrance until **2026-09-14**, when the
user replaced it with a pop-in (`VerticalCutReveal`, skill:
`.cursor/skills/frontend/vertical-cut-reveal.md`). `web/components/ui/decrypt-text.tsx`
and the `.decrypt-char` block in `globals.css` were deleted in the same change. Nothing
in the app consumes this effect now — do not re-add it without an explicit request.

## When this applied

- The `luv13` hero mark took this effect on load.
- The hero text strip also used it until its removal on 2026-09-14.
- **Never on:** user data, API keys, or anything that must be selectable/copyable
  mid-animation, or a line longer than ~60 characters that is not aria-hidden.

## What it did

Copy that arrives decoded instead of typed: every glyph started boiling, then character
*i* locked in at `startDelay + i·stagger ± jitter`, so the line resolved in a ragged
left-to-right sweep rather than a metronome. Lock-in flashed a `currentColor` glow.
Adapted from Motiq's `DecryptText` (MIT) — mechanic theirs, theming ours.

## Implementation notes worth keeping

- **Dropped Motiq's design tokens.** The original injected `--motiq-*` (blue `#315fea`,
  dark surfaces) plus a `terminal` variant. Ours was monochrome and inherited
  `currentColor`.
- **No per-instance `<style>`.** States lived once in `globals.css`. The original
  emitted a scoped style block per instance — with ten marquee repeats that was ten
  style tags.
- **Default `trigger` was `inview`, default `loop` was `false`.** The original defaulted
  to `loop: 7000`, which is wrong for an entrance.
- **Width-stable character cells** (see Pitfalls).
- **`data-motion` / `mounted` removed.** Nothing consumed the attribute.

## Pitfalls (still true of any scramble effect)

- **StrictMode strands the line if you gate on "have I played?".** Dev double-invokes
  effects: mount runs `play()`, the simulated unmount runs the `stop()` cleanup, and the
  second run skips `play()` because `playedRef` was already true — every character stays
  scrambled forever. Gate on `settledRef` plus an idle check so an unfinished run
  restarts. Verified: 545/545 characters stuck in `scramble` before the fix, 0 after.
- **Glyph substitution changes text metrics.** Symbols are wider than letters (~7% on our
  phrase). That reflows a centered line sideways and makes a measured marquee re-fire.
  Fix: each character cell holds an invisible copy of the REAL glyph for width, with the
  animated glyph absolutely overlaid.
- Do not call `setState` directly in an effect body (lint rule
  `react-hooks/set-state-in-effect`); route through a `sync()` helper.
- A `useCallback` cannot call itself (lint rule `react-hooks/immutability`); re-run the
  loop through a `playRef` assigned in an effect.
- Do not write refs during render (`react-hooks/refs`).
- `useLayoutEffect` warns during SSR; use a `useIsomorphicLayoutEffect` helper.
- Assume ~2× the DOM nodes of the plain string. Fine for a heading; not for a paragraph.

## Usage

- 2026-09-13: Created for the `luv13` hero mark.
- 2026-09-14: Retired. Hero mark now pops in with `VerticalCutReveal`.
