---
name: infinite-slider
description: Archived as a logo bar. Home Luv With no longer uses the looping client logo strip; use provider-list.md instead. Re-enabled 2026-09-13 for the hero **text** strip (see frontend/text-marquee.md); no longer a bottom band.
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
- `web/components/marketing/provider-pane.tsx` + `.cursor/skills/frontend/provider-list.md`

## Primitive
- `web/components/ui/infinite-slider.tsx` (needs `react-use-measure`) is unused as a logo bar. Do not wire it back as a logo bar without an explicit request.
- Re-enabled **2026-09-13** for the hero **text** strip: `web/components/marketing/text-marquee.tsx` renders `open-sourced | low price | ai models | hosted by Neuralwatt.com |` repeated, inside `.home-hero-frame` under the `luv13` mark. The primitive now honors `prefers-reduced-motion` with a static row, and it restarts its loop `from` on every width change, so its content must not reflow mid-animation. Spec: `.cursor/skills/frontend/text-marquee.md`.
