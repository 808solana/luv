---
name: site-icons-and-metadata
description: Use when the iOS/Safari start-page tile, home-screen icon, or tab title shows the wrong image or the wrong words. File-convention icons + `metadata.appleWebApp`, and how to cut `app/apple-icon.png` from the brand mark.
created: 2026-09-16
updated: 2026-09-16
tags: [metadata, ios, favicon, apple-touch-icon, safari, seo, layout]
---

# Site Icons & Metadata (LUV13)

## When to Use
- A user reports that **adding/visiting the site on a phone** shows a wrong image (a page screenshot, a chart, the model covers) or a wrong label (`LUV13 — GLM-5.2 Hosting`).
- Adding/renaming any site icon or the browser/tab title.
- You are about to put a **product or model string** into `<title>` or a manifest.
- Don't use when: the complaint is about a *client* raster in the marquee (that is `RASTER_VERSION` / `client-marquee.md`), or about the hero wordmark (that is `vertical-cut-reveal.md`).

## The two levers are different files, and `<link rel="icon">` is not one of them

| What the user sees | Where it comes from | Our file |
| --- | --- | --- |
| Browser tab favicon | `<link rel="icon">` | `web/app/icon.png` (512×512) |
| iOS home screen / Safari start-page tile **image** | `<link rel="apple-touch-icon">` | `web/app/apple-icon.png` (180×180) |
| iOS home screen / Safari start-page tile **label** | `<title>` → `apple-mobile-web-app-title` | `web/app/layout.tsx` `metadata.appleWebApp.title` |

**A favicon is not a touch icon.** LUV13 shipped a correct 512×512 logo favicon for months and iOS *still* drew a page snapshot on the tile — because with no `apple-icon.png` there is no `apple-touch-icon` link, and iOS falls back to a **crop of the rendered page**. That is how the model slideshow covers ended up as the site's avatar (2026-09-16). Adding one file fixed it.

## Steps
1. **Cut the touch icon from the brand mark**, never from a screenshot and never hand-drawn:
```python
from PIL import Image
src = Image.open('web/public/BRAND_ASSETS/LUV13.png').convert('RGBA')
mark = src.crop(src.split()[3].getbbox())          # crop to the visible mark
SIZE, INSET = 180, 8                               # iOS apple-touch-icon size
mark = mark.resize((SIZE - INSET*2, SIZE - INSET*2), Image.LANCZOS)
icon = Image.new('RGB', (SIZE, SIZE), (255, 255, 255))   # opaque white, alpha stripped
icon.paste(mark, (INSET, INSET), mark)
icon.save('web/app/apple-icon.png', 'PNG', optimize=True)
```
2. **Flatten onto `#ffffff` and save as `RGB`.** The brand mark (`BRAND_ASSETS/LUV13.png`) is **ink `#0d0c12`-class pixels on transparency** (measured: opaque pixels average luminance **26**). **iOS composites a transparent touch icon on BLACK** — a near-black mark with no background is invisible on the home screen. White also matches `--color-paper` and every place the mark is currently shown (`auth-shell.tsx`, `dashboard.tsx`, both on `bg-white`).
3. **Leave the padding modest (~4-5%).** iOS applies its own ~22.4% corner mask. The LUV13 mark is widest at mid-height and empty at the corners, so the mask never clips it — do not inset far enough to look like an icon "floating in a box".
4. **Pin the label in `layout.tsx`:**
```tsx
export const metadata: Metadata = {
  title: "luv13",
  description: "We host GLM-5.2. Low costs. Low prices.",
  appleWebApp: { capable: false, title: "luv13" },
};
```
`capable: false` is **not optional** — see pitfalls.
5. **Rebuild and verify the emitted head, not the source.** `npm run build` prints the new route (`○ /apple-icon.png`); then read the served HTML.
6. **Deploy** with `tooling/luv13-production-deploy.md`, then check the public URL (the hashed icon URL is new, so Cloudflare cannot serve stale bytes).

## Pitfalls
- **`metadata.appleWebApp` defaults `capable` to true.** `{ title }` alone emits `<meta name="mobile-web-app-capable" content="yes">`, which makes an iOS home-screen shortcut open **chrome-less**. Pass `capable: false`. (Next also always emits `apple-mobile-web-app-status-bar-style: default` from that object; it is inert without standalone mode, so leave it.)
- **Never put a hosted-model string in `<title>`.** `title: "LUV13 — GLM-5.2 Hosting"` (the pre-2026-09-13 value) is what the user's Safari tile still read as `LUV13 - GLM-5.2…` — tiles truncate to ~20 chars, so the string survives as a permanent, ugly artifact on every device that visited. Title is the **site name only**.
- **A live title change does not repaint an existing tile.** iOS caches the tile (image *and* label) on the device; the user may need to long-press → Delete the suggestion and revisit. Say this out loud instead of assuming the fix failed.
- **Do not test the icon by reading the source PNG.** `python3` + PIL on the alpha channel, printed as ASCII, is how you confirm "is this actually the logo, and is it on white?" without a device. `sips -g pixelWidth -g pixelHeight` confirms the format.
- **Do not cache-bust the icon.** Next hashes the content into the URL (`/apple-icon.png?apple-icon.<hash>.png`) for file-convention icons, so a re-cut gets a fresh URL and the Cloudflare 4h browser-TTL trap (see the deploy skill) does not apply. Replacing `app/icon.png` in place is safe for the same reason.
- **`app/favicon.heic` is dead weight** — `.heic` is not a valid `favicon`/`icon` extension, so Next ignores it. Only `favicon.ico` and `icon.(ico|jpg|jpeg|png|svg)` are conventions.

## Verification
- [ ] `file web/app/apple-icon.png` → `PNG image data, 180 x 180, 8-bit/color RGB` (**no alpha**, 180²)
- [ ] Corner pixel is `(255, 255, 255)`
- [ ] `npm run build` lists `○ /apple-icon.png`
- [ ] Served head has **all three**: `<title>luv13</title>`, `<meta name="apple-mobile-web-app-title" content="luv13"/>`, `<link rel="apple-touch-icon" href="/apple-icon.png?…" sizes="180x180" type="image/png"/>`
- [ ] Served head has **no** `mobile-web-app-capable`
- [ ] `md5` of the public `https://luv13.ai/apple-icon.png?<hash>` matches the local file
- [ ] On the phone: the tile shows the mark on white and reads `luv13` (delete the stale tile first)

## Usage
- count: 1
- 2026-09-16: created. `app/apple-icon.png` cut from `BRAND_ASSETS/LUV13.png` (crop to alpha bbox → 164px on a 180px white field), `appleWebApp: { capable: false, title: "luv13" }` added to `layout.tsx`, deployed to `kor`. Live: hashed apple-icon `md5 cfdf47a6…`, `<title>luv13</title>`.
