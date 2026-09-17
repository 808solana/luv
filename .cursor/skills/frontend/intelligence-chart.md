---
name: intelligence-chart
description: Use when adding or editing the home-page Artificial Analysis chart carousel under the hosted model list, or when adding a chart slide.
created: 2026-09-13
updated: 2026-09-15
tags: [frontend, marketing, models, chart, carousel, image, zoom]
---

# Intelligence Index chart carousel (home)

## When to Use
- Adding a chart slide under the hosted catalog on `#models`
- Changing the carousel's motion, arrows, or thumbnail rail
- Don't use when: iframe/scrape of artificialanalysis.ai, dashboard analytics, or OpenRouter provider rows

## Shape (2026-09-14)
`web/components/marketing/intelligence-chart.tsx` (server) renders a plain
`div.mx-auto.max-w-[80rem]` wrapping `<IntelligenceCarousel />`
(`"use client"`, `web/components/marketing/intelligence-carousel.tsx`).
The single borderless PNG is gone; the user asked for **a border with a carousel**.
The credit line and the in-frame arrow buttons were both **removed at the user's
request** (2026-09-14) — do not re-add either. The `figure`/`figcaption` wrapper
went with the credit; it is a `div` now.

## Adding a slide
1. Export/obtain the chart and upscale it to **2560×938** (`2.5×` Lanczos + `UnsharpMask(radius=2, percent=60, threshold=3)`, the same recipe used for the original). Verify the four corners are `#ffffff` — a non-white bg shows a slab inside the white frame.
2. Drop the file in `web/public/BRAND_ASSETS/intelligence-index/` as the next number (`03.png`, …). The folder is already covered by the middleware matcher, so **no middleware edit is needed**.
3. Add one entry to `INTELLIGENCE_CHART_SLIDES` at the top of `intelligence-carousel.tsx`: `{ src, alt }`. **Array order is the display order** and does not have to follow the filenames — the current set is `02.png` then `01.png`. Write real `alt` text naming the models and scores you can read; do not invent labels for rotated micro-text.
4. Typecheck. The slide box and the thumbnails both derive from `SLIDE_RATIO_CLASS = "aspect-[2560/938]"`, so a file with a different ratio letterboxes inside `bg-contain`.

## Behaviour
- **Auto-advance** every 5s, re-armed on each index change (a manual step always gets a full dwell).
- **Paused** while the pointer is over the frame, mid-drag, while the frame is off-screen (`IntersectionObserver`, threshold 0.2), **while a chart is open in the zoom viewer**, and under `prefers-reduced-motion` (which also sets `transition = { duration: 0 }` and `drag={false}`).
- **Input:** horizontal drag (60px buffer on the **raw pan offset**), `ArrowLeft`/`ArrowRight` on the focused region, and the thumbnail rail. Indices wrap. **There are no arrow buttons** — they were removed 2026-09-14 because they sat inside the frame.
- The region is `role="region"` + `aria-roledescription="carousel"` with `tabIndex={0}`; slides are `role="group"` + `aria-roledescription="slide"` and the inactive ones are `aria-hidden`; the active thumb carries `aria-current="true"`.
- Motion: `translateX` in percent (one slide = one viewport width) with a `spring{mass:3, stiffness:400, damping:50}`; inactive slides scale to `0.96`.
- **Tap/click to zoom (2026-09-15):** the *active* slide carries a sibling `<button aria-label="Zoom into chart N of M">` (`absolute inset-0`, `cursor-zoom-in`) that opens `ImageZoomOverlay` with `SLIDE_RATIO`. The press is remembered in `pressRef` on the frame's `pointerdown` and any travel past `TAP_SLOP = 8px` disqualifies the tap, so sweeping the carousel never opens the viewer. `zoomed !== null` (the index being viewed, or `null`) is **also** in the autoplay pause condition. Full-screen viewer + its own pitfalls: `image-zoom.md`.
- **Stepping inside the viewer (2026-09-16):** the viewer gets `position`, `onPrev` and `onNext`, and `stepZoom(by)` is the one stepper — it sets **both** `zoomed` and the track `index` (`(((zoomed + by) % count) + count) % count`, circular like `goTo`) so a step behind the modal doesn't leave the carousel on a different chart than the one the visitor was reading when they close. The viewer keeps its transform across a step, which is only meaningful because **every slide shares `SLIDE_RATIO`** — keep that invariant when adding a slide (step 4 below is what enforces it at the box level).

## Pitfalls
- **Never decide the drag step from `dragX.get()`.** The track is locked to a single point (`dragConstraints={{ left: 0, right: 0 }}`), and framer-motion mixes an overshooting value through the elastic factor: `applyConstraints` → `mixNumber(min, point, elastic)`, i.e. the motion value only holds `elastic × pointer offset`. With `dragElastic={0.12}` a 240px swipe reported `-28.8px`, so a 60px `DRAG_BUFFER` needed ~500px of travel and the carousel silently refused to step. Read `info.offset.x` (the raw pan offset) in `onDragEnd` instead, and keep `dragElastic` at framer's `0.35` default for a visible rubber band. Verified: a 240px swipe reports `-84px` of track offset (`240 × 0.35`) and steps exactly one slide.
- **The point constraint is deliberate** — it is what makes the drag spring back to 0 so the `animate` `translateX` owns the resting position. Do not switch to a wide `{-800, 800}` range: the track would then rest at a leftover offset and fight `animate`.
- **No raw `<img>` / `next/image` anywhere in the carousel.** Slides *and* thumbnails are `ShieldedImage` (CSS-background `span`). The slide span is `pointer-events-none` so it is never a hit target and the drag reaches the track. See `shielded-images.md`.
- Do not put arrow buttons inside the carousel frame — the user rejected that (2026-09-14). The thumbnail rail is the only chrome; keep it that way unless asked.
- Do not re-add a credit line under the carousel — `facts by artificialanalysis.ai` was removed with the arrows (2026-09-14). `#use-now`'s credit `facts by openrouter.com` was removed the same day, so the site now has **no** credit lines at all; `.hero-neuralwatt` is used only by the `#models` heading.
- Keep the aspect box at `aspect-[2560/938]`. A wrong ratio letterboxes inside `bg-contain` and the frame grows/shrinks oddly.
- The thumbnail row is `px-4` inside the frame; at 375px two `w-16` thumbs + gap fit the content box. Do not bump the base width to `w-24` — that is the `sm:` size and it overflows the padding at 375px.
- Removing the credit tightened the gap to `#use-now` from ~111px to 64px (the section's own `pb-10 md:pb-16`). That is the standard section rhythm — do not add spacer padding back to "make up" for the deleted line.
- Do not `justify-center`/`xl:mx-0` the model list — it is centered at every width, and the carousel sits **under** it (single centered column, `gap-12 md:gap-16`). The two-column layout was explicitly rejected.
- Do not re-add `web/lib/intelligence-index.ts` (no local score snapshot).
- Do not wrap the whole carousel in *another* card/frame — the carousel *is* the frame (`rounded-[20px] border border-black/10 bg-white` + soft shadow).
- Scale animations are easy to misread on a fresh mount: `getBoundingClientRect` right after `browser_navigate` can still report every slide at `transform: none` before framer's first frame. Sample again after ~300ms before concluding the animation is broken. Repeating `browser_navigate` to the *same* URL can also leave the previous React tree alive; navigate with a cache-busting query for a true remount.

## Verification
- [ ] Every width: model list first, carousel directly under it (`carousel top > list bottom`)
- [ ] No horizontal overflow at 375 / 768 / 1280 (`documentElement.scrollWidth === innerWidth`)
- [ ] `#models img` count is `0`; every slide **and** thumbnail is a `span` with `background-size: contain`
- [ ] Box ratio ≈ `2.7292` (2560/938) at every width; slide 375px ≈ `309×113`, 1280px ≈ `1246×457`
- [ ] `curl -H "Sec-Fetch-Dest: document"` on `/BRAND_ASSETS/intelligence-index/01.png` → 404; `Sec-Fetch-Dest: image` → 200 `image/png`
- [ ] Zero chevron SVGs inside the frame; no `facts by artificialanalysis.ai` anywhere in `document.body.innerText`. (A `button[aria-label^="Zoom into chart"]` **does** exist now — one on the active slide, 2026-09-15.)
- [ ] Clicking a thumb moves the track to `translateX(-100%)` and updates `aria-current`
- [ ] `ArrowRight`/`ArrowLeft` on the focused region step forward/back and wrap
- [ ] Tapping the active chart opens the viewer; **sweeping** the track past 8px does not; the carousel is parked while the viewer is up and resumes after it closes (see `image-zoom.md` for the scroll-into-view caveat on that last one)
- [ ] Stepping in the viewer (`‹ ›` or at-fit `←`/`→`) advances the **track** with the viewer: the thumb behind the modal is `aria-current` on the chart the viewer shows, and after `Escape` the `Zoom into chart N of M` label matches it (2026-09-16 — `stepZoom` writes both indices, and autoplay stays parked for the whole time the modal is up)
- [ ] A real pointer drag of ~240px steps exactly one slide (and a short drag does not)
- [ ] With the frame on screen and untouched, the index advances about every 5s and wraps
- [ ] With the pointer resting over the frame, the index holds still (hover pause) — the synthetic `mouseover` route does **not** trigger React's `onMouseEnter`; move the real mouse
- [ ] At 375px the thumbnail rail fits inside the frame padding and there is no horizontal overflow

## Usage
- count: 10
- 2026-09-16: **the zoom viewer steps the set in place** (user: *"even while the users are zoomed in, they still have that little arrow button to switch images while in the zoom mode"*). Carousel side is one new `stepZoom(by)` — it writes `zoomed` **and** `index` circularly so closing the modal leaves the visitor on the chart they were reading — plus the `position`/`onPrev`/`onNext` props and a positional dialog `label`. No change to slides, ratio, thumbs, drag, autoplay or chrome. See `image-zoom.md` for the viewer half (and the focus-steal bug the new steppers exposed).
- 2026-09-15: charts became **tap-to-zoom** — a sibling `<button aria-label="Zoom into chart N of M">` on the active slide opens `ImageZoomOverlay` (`image-zoom.md`), gated on an 8px `TAP_SLOP` against the track drag, with `zoomed !== null` added to the autoplay pause condition. Slides, thumbnails, order, ratio, chrome and motion are unchanged; the zoom viewer is the only new surface.
- 2026-09-14: removed the in-frame arrow buttons and the **facts by artificialanalysis.ai** credit at the user's request. Deleted both `<button>`s + the `lucide-react` chevron import, the now-dead `group/carousel` class (it only existed for the arrows' `group-hover:` reveal), and the `figure`/`figcaption` wrapper (the wrapper is a plain `div.mx-auto.max-w-[80rem]` again). Drag, keyboard and thumbnails are unchanged; `tabIndex={0}` + `focus-visible:ring` stay so keyboard stepping still works. Verified: 0 `button[aria-label$="chart"]`, 0 chevrons, no `artificialanalysis` in `body.innerText`, autoplay still wraps (1→0→1→0), `ArrowLeft` steps `0→1`, a 240px drag steps one slide, gap to `#use-now` now 64px.
- 2026-09-14: dropped the third chart and led with the old middle one — the set is now **two** slides, `02.png` (7-model, GLM-5.3 at 45) then `01.png` (10-model, Claude Fable 5.1 / GPT-6 Astra at 53). Display order lives in `INTELLIGENCE_CHART_SLIDES`, not in the filenames; `03.png` deleted. Nothing else about the carousel changed (thumbs, 5s autoplay, arrows at `sm` and up all still apply with `count === 2`).
- 2026-09-14: borderless single PNG → bordered **carousel** of three 2560×938 charts (`intelligence-index/01–03.png`). Assets moved from `BRAND_ASSETS/intelligence-index.png` into the `intelligence-index/` folder; middleware matcher is now `/BRAND_ASSETS/intelligence-index/:path*` (covers future slides). Thumbnails + drag + arrows + keyboard + 5s auto-advance; arrows `hidden sm:grid` after the 375px check.
- 2026-09-14: chart became a `ShieldedImage` (was a raw `<img>`); matcher gained the asset path.
