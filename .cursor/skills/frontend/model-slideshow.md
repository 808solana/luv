---
name: model-slideshow
description: Use when adding or editing the home-page model list. Compact stacked rows with a small logo, name, and Context / Price / ID.
created: 2026-09-07
updated: 2026-09-13
tags: [frontend, marketing, models, list]
---

# Model list (home)

## When to Use
- Home `#models` section comparing hosted models
- Changing cover images, context, price, ID, or list order
- Don't use when: full `/models` directory cards (card-05)

## Steps
1. Layout: `web/components/marketing/model-pane.tsx` — stacked compact rows, shrink-wrapped with `mx-auto … xl:mx-0`: **centered** when the image stacks below, **left** in the `xl` two-column layout. Row: `flex items-center gap-3 py-2.5`, logo `size-8 sm:size-9`, meta `mt-0.5`. Small **unframed** logo left of the name via `ShieldedImage` (CSS background, not `<img>` / `next/image`); facts on one wrapping line under the name. Do not wrap list logos in circles. Do not `justify-center` this list while it sits beside the chart on `xl`.
2. Data: `web/lib/model-slides.ts` `MODEL_PANE_SLIDES` from `DIRECTORY_MODELS` minus `HIDDEN_FROM_PANE` (GLM-5.2, **DeepSeek V4 Flash** — superseded by V4.1 Flash, embedding, Gemma until a mark exists). Order: Kimi / Kimi Fast, GLM 5.3 / Flash, DeepSeek V4.1 Flash / Pro, Qwen. Caption: **title = model name**, meta **Context / Price / ID**.
3. Wire: `web/components/marketing/model-slideshow.tsx` inside `HomeRest`. White band, black type. Anchors `#models` / `#pricing`.
4. Visible heading is **Infrastructure by Neuralwatt.com** (`.hero-neuralwatt`, centered). Not **Out Now**. Keep ~30px (`mb-[30px]`) between that heading and the two-column body. Section sits ~350px below the hero so it does not crowd the mark.
5. Two columns from **`xl`**: **left** = `ModelPane` (shrink-wrapped, left-aligned on `xl` — do not `justify-center` there). **Right** = `IntelligenceChart` (`web/components/marketing/intelligence-chart.tsx`). Below `xl` the column stacks list-then-chart and the list is **centered** (`mx-auto … xl:mx-0`).
6. Chart is now a **static image**, not a redraw: `web/public/BRAND_ASSETS/intelligence-index.png` (2560×938, pure-white background), rendered **borderless** so it blends into the white page. No frame, radius, or shadow. Credit **facts by artificialanalysis.ai** stays. Do not re-add `web/lib/intelligence-index.ts`. Do not put the two-column split at `lg` — the wide chart gets too small at 1024px.
7. Desktop sizing: row is `max-w-[88rem] xl:max-w-[112rem]`, `xl:gap-10`. On ≥~1900px the image (~1236×453) lines up with the list (**top of Kimi K3 → bottom of Qwen 3.8**). At ~1440px the row is too narrow to match the list height — that is a hard 2.73:1 ratio limit, not a bug. Do not distort or crop the image to force it.
7. Every row is **white**. GLM mark is the black Z on white (`glm.jpg`).

## Row
```
[logo]  Kimi K3
        Context 1 million   Price: $1.15  Per Million Tokens   ID kimi-k3
```
Logo is a square mark, not a circle. Luv With uses the same unframed row shape (`provider-pane.tsx`).

## Caption map
| Field | LUV13 |
| --- | --- |
| Title | Model name (Kimi K3, GLM 5.3, …) |
| Context | `1 million` on every row |
| Price | `$1.15  Per Million Tokens` (label is `Price:`) |
| ID | identifier (`kimi-k3`) |

## Pitfalls
- Do not point this section at login. Account CTAs stay on `#api`.
- Do not show a Producer/provider category on home rows — the logo already names the brand.
- Do not copy the OpenRouter dark theme, badges, token counters, or descriptions — steal the stacked compactness only.
- Context is always **1 million** — do not show 1048.576K / thousands.
- GLM logo is black-on-white Z, not the old white-Z-on-black square.
- Label the identifier **ID**, not Slug.
- Home price line is **Price: $x Per Million Tokens** — not `$x/M tokens`. Directory cards still use `/M tokens`.
- Do not restore `next/image` on pane marks — that brings back “Open Image in New Tab”. See `shielded-images.md`.
- **No DeepSeek V4 Flash on the pane.** It is superseded by **DeepSeek V4.1 Flash**, which is the row we sell. `deepseek-v4-flash` stays in `DIRECTORY_MODELS` for the `/models` directory but must stay in `HIDDEN_FROM_PANE`. Do not add it back to `PANE_ORDER` / `COVERS`.

## Verification
- [ ] Visible heading is **Infrastructure by Neuralwatt.com** (UltraLight Italic)
- [ ] Heading is grouped with the list, not under `luv13`
- [ ] List is left-aligned beside the chart from `xl`; centered when stacked below `xl`
- [ ] Intelligence image is borderless on white (no frame/radius/shadow), right of the list from `xl`
- [ ] Logo left, name to the right, facts under; list logos are not circles
- [ ] Meta is Context / Price / ID only — no Producer
- [ ] ID is visible on every row (mono)

## Usage
- count: 26
