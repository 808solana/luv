---
name: shielded-images
description: Use when adding brand rasters on the public site, or when a visitor can right-click “Open image in new tab”. Paint with ShieldedImage, never a raw <img>.
created: 2026-09-11
updated: 2026-09-15
tags: [frontend, marketing, assets, privacy, zoom]
---

# Shielded brand images

## When to Use
- Model marks on `#models` (`model-pane.tsx`)
- Client marks on `#use-now` (`client-marquee.tsx` — `alt=""`, decorative, because the surrounding `<a>` carries the name)
- The Artificial Analysis chart on `#models` (`intelligence-chart.tsx`)
- Any new public raster that should not expose “Open Image in New Tab”
- Don't use when: the asset is a font, favicon, or a machine string; don't use for dashboard/auth unless asked

## Steps
1. Render with `web/components/ui/shielded-image.tsx` — a `span` + CSS `background-image`. Browsers only attach image context-menu items to `<img>` / `<Image>`. This single change removes **Open image in new tab**, **Save image as**, **Copy image**, **Copy image address**, **Copy text from image**, **Create QR code**, and **Search Google for image** — all of those items are image-node-only.
2. Give the span an explicit box (`size-9`, `h-24 w-24`, …). Backgrounds do not provide intrinsic width. For a full-width raster, keep its ratio with an aspect box instead of intrinsic `width`/`height`: `className="w-full aspect-[2560/938]"`. Wrap in a plain `<div>` if you need a percentage height. Ratio must match the file exactly or `bg-contain` letterboxes.
3. Keep files in `web/public/BRAND_ASSETS/{models,clients}/` (matcher covers the folder). For a one-off family, use its own folder and match `:path*` — e.g. the chart carousel uses `web/public/BRAND_ASSETS/intelligence-index/` with matcher `"/BRAND_ASSETS/intelligence-index/:path*"`, so new slide files need no middleware edit. `web/middleware.ts` returns 404 when `Sec-Fetch-Dest: document` (address bar / “Open in new tab” / pasted URL) and still serves `dest: image` (CSS backgrounds send `image`).
4. Pass `alt` to keep `role="img"` + `aria-label` on the span, so the raster stays describable to screen readers.
5. Add `pointer-events-none` when the raster is purely decorative (the chart and the carousel slides). The box then never becomes a hit target, so nothing on it can be dragged or selected — and if that raster *does* need to be clickable (the chart carousel's tap-to-zoom), put the affordance in a **sibling** `<button className="absolute inset-0">` on top rather than re-enabling pointer events on the span.
6. Do not add a page-wide `onContextMenu` preventDefault — it hides Inspect and does not hide the bytes.

## Pitfalls
- A displayed image is always downloadable (DevTools Network, screenshot, curl without the `Sec-Fetch-Dest` header). This only removes the casual right-click path. Do not claim it is impossible to obtain the bytes.
- Do not put these rasters back on `next/image` or `<img>` — that restores the menu the user wanted gone.
- Do not matcher-block all of `/BRAND_ASSETS/` — fonts live there too. Add exact root filenames one at a time.
- Named marks on `#models` keep `role="img"` (they carry a real `alt`). The `#use-now` marquee marks pass `alt=""` on purpose (2026-09-15): the card is an `<a aria-label="Open {name} on OpenRouter">`, so the raster is decorative and must **not** double up in the accessible name. Do not "fix" that by giving the mark an alt.
- **Tradeoff:** a CSS background has no `loading="lazy"`, so the chart PNG (~484 KB) is no longer natively lazy — expect it earlier in the waterfall than the old `<img loading="lazy">`. Accepted 2026-09-14 in exchange for removing the right-click path. If that ever matters, do **not** solve it by going back to `<img>`.
- Resource Timing is unreliable in the Cursor webview — `getEntriesByType('resource')` came back **empty** even for brand-new on-screen probe elements, and it can report a memory-cache hit as `transferSize: 300, decodedBodySize: 0`, which says nothing about the status code. Do not use it to prove a shielded asset loads.
- Do not verify a shielded raster with a screenshot — element screenshots of the chart returned blank images here, and screenshots are not ground truth in this environment anyway. To prove the browser can fetch the bytes, load the URL into `new Image()` and check `naturalWidth`: `<img>` sends the same `Sec-Fetch-Dest: image` the CSS background does. Do not use `fetch()`, which sends `dest: empty` and bypasses the middleware.

## Verification
- [ ] Right-click a model, client, or chart raster: no image context-menu items
- [ ] `#models` and `#use-now` contain zero `<img>` nodes (`document.querySelectorAll('img').length === 0`)
- [ ] Raster computed `background-size: contain`, `background-repeat: no-repeat`, and the box ratio equals the file ratio
- [ ] `curl -H "Sec-Fetch-Dest: document"` to a shielded URL returns 404
- [ ] `curl -H "Sec-Fetch-Dest: image"` to the same URL returns 200, and `new Image()` reports the true `naturalWidth`
- [ ] Decorative rasters have `pointer-events: none`; any control that needs them (the chart's tap-to-zoom button) is a **sibling** on top, not the span itself

## Usage
- count: 5
- 2026-09-15: the **full-screen zoom viewer** (`components/ui/image-zoom.tsx`) added a second place the chart rasters are painted — it is `ShieldedImage` inside a `pointer-events-none` box too, so opening a chart to 277% still shows **zero** `<img>` on the page and the viewer's own surface (tap, pinch, drag) is handled by the stage `<div>` around it. The carousel's `pointer-events-none` slide spans mean the tap-to-zoom affordance had to become a sibling `<button>`, exactly as step 5 now says.
- 2026-09-15: `#use-now` became a 21-card marquee (`client-marquee.tsx`) — every card is a `ShieldedImage` in an `aspect-square w-full` box with `alt=""` (decorative, the `<a>` names it), and the section still has zero `<img>` nodes. Middleware shield for `/BRAND_ASSETS/clients/:path*` unchanged.
- 2026-09-14: chart converted from a raw `<img>` to `ShieldedImage` + an `aspect-[2560/938]` box + `pointer-events-none`; added the asset path to the middleware matcher.
- 2026-09-14: the chart is now a carousel — **slides and thumbnails are both `ShieldedImage`** (thumbnail spans pass `alt=""`, so they are `aria-hidden` and the button's `aria-label` carries the name). Assets moved into `BRAND_ASSETS/intelligence-index/` and the matcher became a folder (`:path*`) so future slides need no middleware change.
