---
name: text-marquee
description: Use when adding or changing the full-bleed scrolling text strip in the homepage hero, under the luv13 mark. InfiniteSlider + DecryptText entrance; inherits the surface color.
created: 2026-09-13
updated: 2026-09-13
tags: [frontend, marketing, motion, marquee, hero, homepage]
---

# Hero text marquee

Full-bleed strip **inside the hero red field**, directly under the `luv13` mark:

```
open-sourced | low price | ai models | hosted by Neuralwatt.com |
```

repeated, sliding horizontally forever, and decrypting once on load. It has no band, no border, no separators of its own — it inherits the surface's text color and reads as part of the page.

## When to Use

- Changing the hero strip: copy, size, speed, gap, or repeat count.
- Any request for a text-only marquee (not logos/images).
- **Don't use when:** the request is for a logo strip — that pattern is retired (`provider-list.md` covers `#use-now`).

## Steps

1. Component: `web/components/marketing/text-marquee.tsx`. Client component. One `sr-only` phrase + one `aria-hidden` wrapper, so screen readers hear the phrase once rather than ten times.
2. Each repeat is a `DecryptText` with `as="span"`, `trigger="mount"`, `loop={false}`. Props that matter: `speed={40}`, `stagger={22}`, `startDelay={160}`, `jitter={90}`, `seed={7}`. Same seed for every unit, so all repeats resolve together instead of rippling.
3. Type: `font-sans text-[clamp(1.125rem,2.7vw,2.025rem)] leading-none tracking-tight whitespace-nowrap`. That is ~55% smaller than the earlier display-sized band (32.4px at 1280, 18px at 390).
4. Rhythm: `gap={28}` on `InfiniteSlider`, `duration={72}`. 72s is deliberately half-speed; the earlier band ran at 36s. `REPEATS = 5` gives a copy width of ~4.8k at 1280, comfortably wider than any viewport.
5. Placement: `web/app/page.tsx`, inside `.home-hero-frame`, as a sibling **after** the `#hero` section. It inherits `text-paper` via `className="text-paper"`, so the white comes from the surface, not from the component.
6. Vertical padding belongs on the strip (`py-6 md:py-8`), which is the "padding under luv13" the layout calls for. Horizontal padding must stay at zero — the strip is meant to run edge to edge.
7. Reduced motion is handled **inside** `InfiniteSlider` (static clipped row) and inside `DecryptText` (resolves immediately). Never gate it in `text-marquee.tsx` only.

## Pitfalls

- **Never let the entrance change the strip's width.** `InfiniteSlider` re-measures with `useMeasure` and restarts `animate(translation, [from, to])` from `from` on every resize, so any width change snaps the strip back to 0. Glyph substitution changes text metrics, which is why `DecryptText` sizes each character cell with an invisible copy of the real glyph. Do not "simplify" that back to a bare span.
- Do not put the strip at the bottom of the page or below the footer. It lives in the hero; the footer is the last thing on the page.
- `MarketingShell` no longer takes a `bottomBand` prop. If you need a page-level band, add it explicitly in that page.
- `leading-none` is safe here only because every glyph is wrapped in its own cell with a fixed line box. If you flatten the markup, descenders clip inside the slider's `overflow-hidden`.
- Reduced motion must not be re-implemented per consumer; a future `InfiniteSlider` user would then animate unconditionally.

## Verification

- [ ] `npm run typecheck`, `npm run build` (exit 0), `npm test` all pass.
- [ ] `.decrypt-char` count goes from all-`scramble` to all-`plain` within ~1.5s of load.
- [ ] The slider's measured width is **constant** through the entrance (sample it every ~90ms; a drifting width means re-measure snapping).
- [ ] The slider transform advances monotonically from the first frames, at ~68px/s at 1280 (≈70s per loop).
- [ ] Strip is full-bleed: `getBoundingClientRect().left === 0`, width === `window.innerWidth`, `borderTopWidth === 0px`, transparent background.
- [ ] Under emulated `prefers-reduced-motion: reduce`: zero `scramble` characters and `transform: none`.

## Usage

- count: 1
