---
name: decrypt-text
description: Use when adding or debugging the glyph-scramble "decrypt" entrance on headings or marquee text. Covers the width-stable character cells, StrictMode-safe orchestration, and reduced-motion fallback.
created: 2026-09-13
updated: 2026-09-13
tags: [frontend, motion, animation, typography, hero, accessibility]
---

# DecryptText

Copy that arrives decoded instead of typed: every glyph starts boiling, then character *i* locks in at `startDelay + i·stagger ± jitter`, so the line resolves in a ragged left-to-right sweep rather than a metronome. Lock-in flashes a `currentColor` glow.

Adapted from Motiq's `DecryptText` (MIT). The mechanic is theirs; the theming is ours.

## When to Use

- The `luv13` hero mark and the hero text strip — both take this effect on load.
- Any heading or line of copy that should decode on mount.
- **Don't use when:** the text is user data, an API key, or anything that must be selectable/copyable mid-animation, or when the line is longer than ~60 characters and not aria-hidden.

## What we changed from the reference

- **Dropped Motiq's design tokens.** The original injects `--motiq-*` (blue `#315fea`, dark surfaces) plus a `terminal` variant. Both are gone; this component is monochrome and inherits `currentColor`.
- **No per-instance `<style>`.** States live once in `web/app/globals.css` (`.decrypt-char` + `decrypt-lock` keyframes). The original emitted a scoped style block per instance — with ten marquee repeats that is ten style tags.
- **Default `trigger` is `inview` and default `loop` is `false`.** The original defaulted to `loop: 7000`, which is wrong for an entrance.
- **Width-stable character cells** (see Pitfalls).
- **`data-motion` / `mounted` removed.** Nothing consumed the attribute, and the extra `setState` in an effect was not worth it.

## Steps

1. Component: `web/components/ui/decrypt-text.tsx`. CSS: the `.decrypt-char` block in `web/app/globals.css`.
2. Readable text is an `sr-only` sibling; the animated glyph layer is `aria-hidden`. Assistive tech never hears the scramble.
3. Orchestration lives in one layout effect:
   - reduced motion → `stop()` + `resolveAll()`, mark settled;
   - `hover` trigger → resolve immediately, play on pointer enter;
   - `inview` + off-screen → stop;
   - idle and not settled → `play()`.
4. Theme by surface, not by prop: the hero passes `text-paper`, so scramble dims to 40% white and lock-in glows white. On a white section it inherits ink with no change.
5. Tuning that worked: hero `speed={38} stagger={115} startDelay={220} jitter={60} seed={13}`; strip `speed={40} stagger={22} startDelay={160} jitter={90} seed={7}`.

## Pitfalls

- **StrictMode will strand the line if you gate on "have I played?".** Dev double-invokes effects: mount runs `play()`, the simulated unmount runs the `stop()` cleanup, and the second run would skip `play()` because a `playedRef` was already true — leaving every character scrambled forever. Gate on `settledRef` plus an idle check instead, so an unfinished run restarts. Verified: 545/545 characters stuck in `scramble` before the fix, 0 after.
- **Glyph substitution changes text metrics.** Symbols are wider than letters (~7% on our phrase). That reflows a centered line sideways and makes `InfiniteSlider`'s `useMeasure` re-fire, restarting its `animate()` from 0 — the strip appears frozen then jumps. Fix: each character cell contains an invisible copy of the REAL glyph for width, with the animated glyph absolutely overlaid. Keep it.
- Do not call `setState` directly in an effect body (lint rule `react-hooks/set-state-in-effect`); route through a `sync()` helper, as `cycling-words.tsx` does.
- A `useCallback` cannot call itself (lint rule `react-hooks/immutability`). The loop re-run goes through `playRef`, assigned in an effect.
- Do not write refs during render (`react-hooks/refs`). Assign `onDecryptedRef.current` in an effect.
- `useLayoutEffect` warns during SSR; use the `useIsomorphicLayoutEffect` helper already in the file.
- Every cell spans a real glyph, so assume ~2× the DOM nodes of the plain string. Fine for a heading and for ~10 short marquee repeats; do not use it on a paragraph.

## Verification

- [ ] `npm run typecheck`, `npm run build` (exit 0), `npm test`, `npx eslint` on the touched files all pass.
- [ ] Shortly after load, `.decrypt-char[data-state="scramble"]` is most of the characters; ~1.5s later it is zero and all are `plain`.
- [ ] The element's `getBoundingClientRect().width` does not change across the entrance.
- [ ] With emulated `prefers-reduced-motion: reduce`, zero characters are ever in `scramble`.
- [ ] Screen reader text equals the real string (one `sr-only` per instance).

## Usage

- count: 1
