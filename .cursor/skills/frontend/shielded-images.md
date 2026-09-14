---
name: shielded-images
description: Use when adding brand rasters on the public site, or when a visitor can right-click “Open image in new tab”. Paint with ShieldedImage, never a raw <img>.
created: 2026-09-11
updated: 2026-09-11
tags: [frontend, marketing, assets, privacy]
---

# Shielded brand images

## When to Use
- Model marks on `#models` (`model-pane.tsx`)
- Client marks on `#use-now` (`provider-pane.tsx`)
- Any new public raster that should not expose “Open Image in New Tab”
- Don't use when: the asset is a font, favicon, or a machine string; don't use for dashboard/auth unless asked

## Steps
1. Render with `web/components/ui/shielded-image.tsx` — a `span` + CSS `background-image`. Browsers only attach image context-menu items to `<img>` / `<Image>`.
2. Give the span an explicit box (`size-9`, `h-24 w-24`, …). Backgrounds do not provide intrinsic width.
3. Keep files in `web/public/BRAND_ASSETS/{models,clients}/`. `web/middleware.ts` returns 404 when `Sec-Fetch-Dest: document` (address bar / Open in new tab) and still serves `dest: image` (CSS backgrounds).
4. Do not add a page-wide `onContextMenu` preventDefault — it hides Inspect and does not hide the bytes.

## Pitfalls
- A displayed image is always downloadable (DevTools Network, screenshot, curl without that header). This only removes the casual right-click path.
- Do not put these rasters back on `next/image` or `<img>` — that restores the menu the user wanted gone.
- Do not matcher-block all of `/BRAND_ASSETS/` — fonts live there too.
- Named marks on `#models` and `#use-now` keep `role="img"`.

## Verification
- [ ] Right-click a model or Luv With mark: no “Open Image in New Tab” / “Save Image As”
- [ ] `#models` and `#use-now` contain zero `<img>` nodes
- [ ] `curl -H "Sec-Fetch-Dest: document"` to a model/client URL returns 404
- [ ] `curl -H "Sec-Fetch-Dest: image"` to the same URL returns 200 and the page still paints the mark

## Usage
- count: 1
