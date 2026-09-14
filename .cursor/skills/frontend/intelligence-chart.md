---
name: intelligence-chart
description: Use when adding or editing the home-page Artificial Analysis Intelligence Index image beside the hosted model list.
created: 2026-09-13
updated: 2026-09-13
tags: [frontend, marketing, models, chart, image]
---

# Intelligence Index chart (home)

## When to Use
- Putting the public scoreboard next to the hosted catalog on `#models`
- Swapping in a newer Artificial Analysis Index image
- Don't use when: iframe/scrape of artificialanalysis.ai, dashboard analytics, or OpenRouter provider rows

## Steps
1. Asset: `web/public/BRAND_ASSETS/intelligence-index.png` (2560×938 — the 1024×375 supplied chart pre-upscaled ~2.5× with Lanczos + unsharp, **pure white background**). Verify the corners are `#ffffff` before shipping; a non-white bg shows a visible slab on the white page.
2. Why upscale: the supplied chart is only 1024px wide. At ~764 CSS px on a 2× display the browser must *up*-scale it and it looks soft. Ship ≥2× the intended CSS width so the browser *down*-scales instead. **Upscaling cannot add detail** — the only true fix for large sizes is a higher-resolution export from the source or a vector re-render.
3. UI: `web/components/marketing/intelligence-chart.tsx`. A **borderless** `<img>` (`h-auto w-full xl:max-w-[80rem]`), no frame, no radius, no shadow, no `AspectRatio` card — the white image melts into the white page. Keep intrinsic `width`/`height` (2560/938) to reserve space and avoid layout shift. `loading="lazy"`, `decoding="async"`.
4. Borderless `<img>` needs the eslint disable comment `@next/next/no-img-element` (same convention as `coverflow-carousel.tsx`). The `ShieldedImage` convention is only for brand rasters under `/BRAND_ASSETS/{models,clients}` — this third-party chart stays a real `<img>` for alt semantics.
5. Alt text: describe the ranking + the scores you can verify from the image. Do not invent labels for rotated micro-text you cannot read.
6. Credit **facts by artificialanalysis.ai** (`.hero-neuralwatt`) links to `https://artificialanalysis.ai/#intelligence`. Keep it.
7. Layout: `web/components/marketing/model-slideshow.tsx`. Two columns from **`xl`** (1280px): list **left** (`xl:shrink-0`), image **right** (`xl:flex-1`). Below `xl` the container is `flex-col` so the image stacks under the list.
8. Desktop sizing: the row is `max-w-[88rem] xl:max-w-[112rem]` with `xl:gap-10`. On ≥~1900px viewports the image reaches ~1236px wide / ~453px tall, which lines its top and bottom up with the model list (**top of Kimi K3 → bottom of Qwen 3.8**). At ~1440px this is geometrically impossible — see Pitfalls.
9. `ModelPane` root carries `mx-auto … xl:mx-0` so the shrink-wrapped list **centers** when stacked and returns to **left** in the two-column layout.

## Pitfalls
- Do not wrap the image in a bordered/rounded/shadowed card — that was the rejected "effect". The ask is explicitly borderless-on-white.
- Do not use `mix-blend-mode` — the PNG background is already pure white, so blending is unnecessary and can tint the bars.
- Do not use `object-cover` inside a fixed box; the whole chart (title, bars, labels, watermark) must be visible, so keep the natural ratio.
- **Height-matching the list is width-limited.** The chart is 2.73:1, so matching the list's ~458px height needs ~1251px of width. At 1440px the whole row is only ~1344px, and the list alone takes ~516px + gap, leaving ~788px (→ ~289px tall). Only ~1900px+ viewports can match. Do not "fix" this by distorting the ratio or by `object-cover` cropping — both damage the chart.
- Do not breakpoint the two-column split at `lg`; at 1024px the right column is ~346px and unreadable.
- Do not `justify-center` the list in the two-column layout — it stays left there, centered only when stacked.
- Do not re-add `web/lib/intelligence-index.ts`; there is no local score snapshot anymore.
- **Source-resolution ceiling (2026-09-13):** the supplied chart is a 1024×375 snapshot whose exact model set (scores 53/53/50/47/45/44/42/40/34/31) is **not** reproducible from live artificialanalysis.ai — the homepage highlights chart reads 53/53/51/48/45/44/44/41/40/38/36 (11 bars) and the article chart 25 bars. Do not "upgrade" the asset by scraping their live chart; the numbers would change. AA does expose a per-chart **"Download chart as image"** export on article pages (e.g. `/articles/artificial-analysis-intelligence-index-v4-3`) — that is the right way to get a higher-res export of whatever chart is wanted.

## Verification
- [ ] Desktop ≥1280: catalog left, image right
- [ ] <1280: list then image, no horizontal overflow
- [ ] List centered when stacked (pane center ≈ viewport center at 375/768)
- [ ] Image computed border/radius/shadow are `0px` / `none`
- [ ] Image natural size 2560×938, white corners
- [ ] At 1920: image top/bottom ≈ list top/bottom
- [ ] Credit opens `https://artificialanalysis.ai/#intelligence`

## Usage
- count: 3
