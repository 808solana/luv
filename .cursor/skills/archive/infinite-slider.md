---
name: infinite-slider
description: Archived as a logo bar. Home Luv With no longer uses the looping client logo strip; use frontend/client-marquee.md instead (a CSS keyframe marquee, not this primitive). Kept for the motion notes (width-stable content inside InfiniteSlider) if a text marquee ever returns.
created: 2026-09-09
updated: 2026-09-13
status: stale
tags: [frontend, marketing, motion, slider, archive]
---

# Infinite slider (archived)

Replaced on 2026-09-11 by the stacked provider list under Luv With.

## When this applied
- The looping client wordmark strip under **Use Now**

## What replaced it
- `web/components/marketing/provider-pane.tsx` (deleted 2026-09-15)
- `.cursor/skills/archive/provider-list.md`

## 2026-09-15 — a client marquee came back, but not as this primitive
The user asked for a full-bleed sliding image row in `#use-now`. It was built as a
**CSS keyframe** marquee in `web/components/marketing/client-marquee.tsx`
(skill: `frontend/client-marquee.md`) instead of with `InfiniteSlider`, for two
reasons recorded here so this does not get "simplified" later:
1. `InfiniteSlider` renders `{children}{children}` with no hook to make copy 2
   `inert`/`aria-hidden`, so every duplicated card would become a second tab stop.
2. It re-measures with `useMeasure` and restarts `animate(translation, [from, to])`
   from `from` on every width change (the width-stability trap below).

The CSS marquee keeps the parts of this primitive that were right: a static
reduced-motion row and a pause while off-screen / tab-hidden (step 6 of
`smooth-scroll-fx.md`) — the pause is now a `data-paused` attribute instead of
framer `.pause()`.

## Primitive
- `web/components/ui/infinite-slider.tsx` (needs `react-use-measure`) is unused as a logo bar. Do not wire it back as a logo bar without an explicit request.
- Re-enabled **2026-09-13** for the hero **text** strip (`text-marquee.tsx`), then **removed 2026-09-14** when the user rejected the sliding effect. **Still unused as of 2026-09-15** (the `#use-now` client marquee is its own CSS component). If it is ever reused, remember it honors `prefers-reduced-motion` with a static row and it restarts its loop `from` on every width change, so its content must not reflow mid-animation. Spec: `.cursor/skills/archive/text-marquee.md`.
