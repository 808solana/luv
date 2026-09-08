---
name: typography
description: Use when designing, implementing, or reviewing LUV13 marketing/site typography, buttons, section backgrounds, overlay menus, or any visual remake that should follow the Hims-inspired LUV13 type system. Canonical source of truth for fonts, type scale, pills, and surfaces.
created: 2026-09-06
updated: 2026-09-06
tags: [frontend, typography, design-system, hims, luv13, pills, marketing]
---

# LUV13 Typography

Hims.com layout and interaction patterns, wrapped around LUV13 identity. LUV13 fonts stay. LUV13 colors stay: white page, black text, white round pills. The product in every example is our AI **services** (hosted models, API access, pay-as-you-go credit) — never medical products.

**This file is the canonical spec.** Do not spawn extra typography markdown. Implement later work against these tokens.

## When to Use

- Any marketing page, overlay menu, hero, service card, CTA, or section background on `web/`.
- Choosing fonts, sizes, tracking, leading, pill geometry, or type color.
- Remaking the current video-on-black homepage into the white Hims-rhythm site.

**Don't use when:** backend, billing math, API metering, or dashboard data logic with no visual change. Dashboard screens may keep existing shadcn density until a later pass, but new CTAs on those screens should still use the pill recipe below.

**Don't use this to copy Hims.** Copy the *system* (pairing, pills, section rhythm). Never copy their medical copy, product names, or gold emphasis color.

---

## Brand pairing

Keep LUV13 type. Layer the Hims *roles* onto those faces.

| Role | Face | Why |
| --- | --- | --- |
| Logo mark | `BRAND_ASSETS/LUV13.png` (served as `/BRAND_ASSETS/LUV13.png`) | Brand source of truth. Do not replace with a fake Didone wordmark. |
| Sans — UI, body, headlines, buttons | Helvetica Neue / HelveticaNeue-Bold | Existing LUV13 geometric sans. This is the Hims "bold geometric headline" role. |
| Serif — italic emphasis inside headlines; overlay "Menu" title | Instrument Serif | Already in the stack. This is the Hims "elegant serif" role. On LUV13 the italic stays **black**, not gold. |
| Mono — slugs, keys, URLs, curl, prices in tables | Tailwind `font-mono` / existing ui-monospace stack | Data, not display. Tabular nums on money and token counts. |

### Stacks (adopt in `web/app/globals.css` `@theme inline`)

These already exist. Keep them. Do not let the Vercel theme's `"General Sans"` win — it is overridden post-bridge today; keep that override.

```css
--font-sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
--font-serif: "Instrument Serif", Georgia, "Times New Roman", serif;
--font-helveticaneue-bold: "HelveticaNeue-Bold", "Helvetica Neue", Helvetica, Arial, sans-serif;
--font-mono: ui-monospace, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;
```

Tailwind: `font-sans`, `font-serif`, `font-helveticaneue-bold`, `font-mono`.

Existing helper:

```css
.font-serif-italic {
  font-family: var(--font-serif);
  font-style: italic;
}
```

### Where to load them

| Face | Load |
| --- | --- |
| Helvetica Neue | System `local()` first. |
| HelveticaNeue-Bold | Served from `web/public/BRAND_ASSETS/HelveticaNeue-Bold.otf` via `@font-face` `url("/BRAND_ASSETS/HelveticaNeue-Bold.otf")` plus `local()`. |
| Instrument Serif | Google Fonts in `web/app/layout.tsx`: `family=Instrument+Serif:ital,wght@0,400;1,400`. Keep the googleapis / gstatic preconnects. |
| Specimen | `BRAND_ASSETS/typography.png` — visual check for the LUV13 sans, not a Hims clone. |

Do not add Sofia, Sofia Pro, Circular, or any Hims webfont. Secondary write-ups name those for *their* site; they were not inspected here, and they are not LUV13.

---

## Type scale

Ink is always `--ink` (`#0d0c12`, treated as black). On a **dark section only**, invert to `--paper` (`#ffffff`). No gray-as-brand; muted is still black at reduced opacity.

Use `text-wrap: balance` on display/h1–h3. `text-wrap: pretty` on body. `-webkit-font-smoothing: antialiased` on `html`. `tabular-nums` on prices, balances, token counts.

| Token | Size | Weight | Line-height | Tracking | Color (light) | Tailwind |
| --- | --- | --- | --- | --- | --- | --- |
| Logo (PNG) | 32–40px tall in nav | — | — | — | as-authored | `h-8` / `h-10` |
| Display | 48 / 64 / 80px (sm/md/xl) | 700 HelveticaNeue-Bold | 0.92–0.96 | `-0.03em` | ink | `text-5xl md:text-7xl xl:text-[5rem] font-helveticaneue-bold tracking-tight leading-[0.94]` |
| Display emphasis | same size as surrounding display | 400 italic Instrument Serif | inherit | `-0.01em` | ink (not gold) | `font-serif italic font-normal` |
| h1 | 36 / 48 / 56px | 700 | 1.0 | `-0.025em` | ink | `text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight` |
| h2 | 28 / 36 / 40px | 700 | 1.1 | `-0.02em` | ink | `text-3xl md:text-4xl font-bold tracking-tight` |
| h3 | 22 / 24 / 28px | 700 | 1.2 | `-0.015em` | ink | `text-xl md:text-2xl font-bold tracking-tight` |
| Body | 16–18px | 400–500 | 1.5–1.65 | 0 | ink | `text-base md:text-lg font-medium leading-relaxed` |
| Body muted | 16px | 500 | 1.5 | 0 | `ink / 70%` | `text-sm md:text-base font-medium text-black/70` |
| UI / button | 14px | 600–700 | 1 | `0.01em` | ink on white pill | `text-sm font-semibold` or `font-bold` |
| Eyebrow / section label | 11–12px | 700 | 1 | `0.18em`–`0.2em` | `ink / 45–50%` | `text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-black/50` |
| Caption / badge | 12px | 600 | 1.2 | `0.02em` | ink | `text-xs font-semibold` |
| Legal | 11–12px | 400 | 1.45 | 0 | `ink / 40%` | `text-[11px] leading-snug text-black/40` |
| Mono slug | 12–14px | 500 | 1.4 | `-0.01em` | ink | `font-mono text-xs sm:text-sm` |

Sentence case on buttons and headlines. Never all-caps on CTAs. All-caps only for eyebrows (`EXPLORE`, `MODELS`, `PRICING`).

Hero measure: ~18–28ch. Body measure: ~65ch.

Existing mixed-style headlines: `WordsPullUpMultiStyle` in `web/components/words-pull-up.tsx` — put the italic serif class on the emphasis segment.

---

## Color & surfaces

### Defaults (non-negotiable)

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#ffffff` | Default **page** background. `html` and `body` on the remake. |
| `--ink` | `#0d0c12` | All text on light surfaces. This is LUV13 black. |
| `--pill` | `#ffffff` | CTA fill. |
| `--pill-ink` | `#0d0c12` | CTA text and 1px border. |
| `--hairline` | `rgba(13, 12, 18, 0.12)` | Card rings, menu row separators (prefer spacing over rules). |

The Vercel/shadcn `--primary` vivid blue (`oklch(0.485 0.291 264.121)`) is **not** a marketing CTA color. Do not paint pills blue. Old brand button brown `#675c56` is also retired for marketing CTAs.

Muted text = `text-black/70`, `/50`, `/40` — still black, not a second gray palette.

### Page vs section

The **page base is always white**. A section may introduce a **sub-background** while it is in view, then the page returns to white. The section owns the color; the site chrome (when over white) stays black-on-white.

**Light sub-backgrounds** (black text, white pills):

| Token | Hex | Use |
| --- | --- | --- |
| `--section-cream` | `#f6f3ee` | Default tinted band, cream service cards |
| `--section-stone` | `#eee9e2` | Alternate light band |
| `--section-mist` | `#e7e4de` | Dense card wells inside a cream section |

**Dark sub-backgrounds** (use sparingly — one, maybe two, per long page):

| Token | Hex | Use |
| --- | --- | --- |
| `--section-ink` | `#0d0c12` | Near-black band |
| `--section-navy` | `#12141c` | Cool dark band |

On dark sections: headlines and body invert to `#ffffff`. Muted becomes `text-white/70`. **Pills stay white with black text** (same as Hims “Log in” on a dark nav). Do not fill CTAs tan/gold.

When a section goes dark: type color inverts; logo PNG may need a white treatment or stay as-authored — do not recolor the PNG arbitrarily; prefer a light-nav-on-dark or keep the existing asset if it already reads.

Do not use Hims chocolate/gold as LUV13 brand color. Warm cream is allowed as a *section* tint so the white page can still breathe. Gold italic is forbidden; emphasis is italic serif in ink (or white on dark).

---

## Pills

Every marketing CTA, nav “Log in”, and overlay close-adjacent action is a pill.

### Geometry

- `border-radius: 9999px` (`rounded-full`). `rounded-[100px]` on `FlowButton` is already pill-equivalent; standardize on `rounded-full`.
- Min height 44px (`min-h-11` is 44px — keep). Primary hero CTA may be `min-h-12`.
- Horizontal padding `px-6` to `px-8`.
- Fill: white. Text: black. Border: `1px solid #0d0c12` (`border border-black` or `ring-1 ring-black`).
- No sharp corners. No `rounded-lg` / `rounded-md` on buttons (current `web/components/ui/button.tsx` variants are shadcn rectangles — do not use them for marketing CTAs).

Secondary/ghost on a **dark** card: transparent fill, `1px solid white`, white text, still `rounded-full`. That is the only exception to white-fill pills. Do not use it on the white page.

### Regrow motion

Hims pills feel like they breathe on hover: an outline grows out, then the shape holds. Live computed keyframes were **not** inspectable (Cloudflare challenge; no browser tools). This CSS matches that feel on LUV13 colors, using `transform` + `box-shadow` only (no width/height animation).

Press scale stays the project standard from `make-interfaces-feel-better`: **`0.96`**, never below `0.95`.

```css
.pill-cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0.75rem 2rem;
  border-radius: 9999px;
  background: #ffffff;
  color: #0d0c12;
  border: 1px solid #0d0c12;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition:
    transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.pill-cta:hover {
  transform: scale(1.02);
  /* outline grows out of the border, then holds */
  box-shadow: 0 0 0 3px #ffffff, 0 0 0 4px #0d0c12;
}
.pill-cta:active {
  transform: scale(0.96);
  box-shadow: 0 0 0 0 #ffffff, 0 0 0 0 #0d0c12;
}
.pill-cta:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px #ffffff, 0 0 0 5px #0d0c12;
}
@media (prefers-reduced-motion: reduce) {
  .pill-cta:hover,
  .pill-cta:active {
    transform: none;
    box-shadow: none;
  }
}
```

Tailwind equivalent for implementation:

```
rounded-full min-h-11 bg-white px-8 text-sm font-semibold text-black
border border-black
transition-[transform,box-shadow] duration-200 ease-out
hover:scale-[1.02] hover:shadow-[0_0_0_3px_#fff,0_0_0_4px_#0d0c12]
active:scale-[0.96]
focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#fff,0_0_0_5px_#0d0c12]
```

On a dark section, keep the white fill; the white ring in the shadow (`3px #fff`) still separates the growing hairline from the dark ground.

`FlowButton` today: glass (`bg-white/25`), arrow slide, `active:scale-[0.96]`. On remake, drop liquid-glass on marketing CTAs. Arrow slide may stay as extra motion; regrow outline is required.

---

## Section rhythm

1. `html`/`body` background: white. No site-wide video as the page color. (Current scroll-video + `html { background:#000 }` + transparent body is the **old** surface. Remake replaces it.)
2. Nav sits on white (or transparent over white). Ink logo, white Log in pill, hamburger.
3. Hero on `/` is a full-viewport poster (`/BRAND_ASSETS/hero-home.jpg`) on `#fe0000`. Do not recreate the poster in HTML. Other marketing pages stay white/cream. Type on those pages stays black on cream/white.
4. Following sections: either remain white with padded cards, **or** a full-bleed band with `rounded-t-[32px]` to `rounded-t-[48px]` that visually “scrolls up” over the previous white. Large radius on the section itself, not only inner cards.
5. After a tinted/dark band, the next section returns to white. Do not leave the rest of the page stuck on brown.
6. Inner cards: `rounded-[24px]` to `rounded-[32px]` (`rounded-3xl` is 24px; use `rounded-[32px]` for Hims-soft). Padding `p-8 md:p-12`. Generous gaps (`gap-4` minimum between cards; section `py-20 md:py-28` already matches current page — keep or increase, never tighten).
7. Concentric radius: outer section 48px + inner card 32px + inner pill 9999px. Do not put `rounded-xl` (12px) cards inside a 48px section.

**Type inversion rule:** light section → ink. Dark section → white. Pills do not invert fill.

---

## Component type recipes

Copy is LUV13 AI services. Not weight loss, not Rx, not GLP-1.

### Nav

- Left: `LUV13.png`, ~32–40px high.
- Right: pill `Log in` → `/login` + hamburger (three hairlines, 24px).
- No serif in the nav except if a text fallback for the logo is needed (`luv13` lowercase Instrument Serif, ink). Prefer the PNG.

### Hero (`/`)

The homepage hero is the red poster image, not HTML type.

- Asset: `/BRAND_ASSETS/hero-home.jpg` (source red `#fe0000`).
- Section: full viewport (`min-h-dvh`), `bg-[#fe0000]`, `next/image` `fill` + `object-contain` so the poster type at the edges is never cropped. Letterboxing is the same red.
- Homepage nav uses `MarketingShell overlayHeader`: `fixed` transparent header over the poster so the red reaches the top of the viewport. Other marketing pages keep the sticky white header.
- No “Hosted models”, “Cheapest access…”, GLM/pay-per-token subcopy, or Create account CTA in the hero. Keep an `sr-only` h1 for the poster line.
- The cream models band (`rounded-t-[48px]`) overlaps the poster (`-mt-12`) so the corners show red, not white.

On other marketing pages, headlines stay Helvetica Bold with one italic Instrument Serif word, all ink on paper. Subhead: `text-base md:text-lg font-medium text-black/70`. Primary CTA: pill “Create account” → `/signup`.

### Service cards (models / API — not products)

Card: cream or white on white page, `rounded-[32px]`, `p-8`.

- Eyebrow: `MODELS` / `API` (uppercase tracked sans).
- Title: h3 Helvetica Bold — e.g. `GLM-5.2`.
- Meta: body muted — `$0.33 per 1M total tokens` with `tabular-nums`.
- Slug: `font-mono text-xs text-black/50` — `luv13-glm-5.2`.
- Chevron (`>`) bottom-right, 1.5px stroke, ink, as click affordance.
- Coming-soon models: same card, badge pill `Coming soon` (small white pill, black type, no regrow needed at this size).

Do not put injector-pen photography, “From $149/mo”, or medical seals on these cards.

### Overlay menu

White panel, `rounded-[32px]`, generous padding, over a dimmed page (not a second website).

- Title: Instrument Serif roman, ~36–44px, ink — `Menu`.
- Section labels: eyebrow style — `EXPLORE`, `MODELS`.
- Rows: Helvetica 18–20px medium, full-width, no dividing borders, chevron right (`>`). Examples: `Models`, `Pricing`, `API`, `Dashboard`, `Create account`.
- Footer of menu: small service cards (GLM-5.2, API keys, Top up) on `--section-cream`, `rounded-[24px]`.
- Close: circular `X`, 44px hit area.

### CTAs

| Context | Label examples | Style |
| --- | --- | --- |
| Nav | Log in | White pill, black type, 1px black border, regrow |
| Hero | Create account | Same, `min-h-12` |
| Pricing | Create your key | Same |
| Dark section | Get started | Same white pill (does not invert) |
| Quiz-style choice on a dark card | Connect Cursor / Use the API / Top up credit | Ghost pill: transparent, white hairline, white type |

---

## Do / don't

**Do**

- Keep Helvetica Neue + Instrument Serif.
- Keep white page, black text, white pills.
- Use italic serif for one emphasis word in a display line.
- Use `rounded-full` pills with the regrow shadow.
- Let sections pick up cream or rare near-black, then return to white.
- Write “we”. Talk about models, tokens, keys, credit, Cursor.
- `text-wrap: balance` on headlines; `tabular-nums` on money/tokens.
- Respect `prefers-reduced-motion` (kill regrow scale/shadow).

**Don't**

- Don't copy Hims medical copy or product names (no Wegovy, GLP-1, hair, Rx).
- Don't throw away LUV13 fonts for Sofia/Circular/system-ui-as-brand.
- Don't use gold/tan for italic emphasis or for primary pills.
- Don't use the shadcn blue `--primary` as a marketing button fill.
- Don't use sharp corners on buttons (`rounded-lg`, `rounded-md`).
- Don't set the whole site on chocolate/navy; dark is a section, not the page.
- Don't keep `html { background:#000 }` + transparent body once the remake lands.
- Don't invent companion/dating-AI copy. The product is hosted LLM access.
- Don't mention OpenRouter on the public site.

---

## Example snippets

### Tokens to add on remake (`web/app/globals.css`)

Keep existing oklch shadcn bridge for dashboard primitives. Add these marketing tokens and use them on the public site:

```css
:root {
  --ink: #0d0c12;
  --paper: #ffffff;
  --pill: #ffffff;
  --pill-ink: #0d0c12;
  --section-cream: #f6f3ee;
  --section-stone: #eee9e2;
  --section-mist: #e7e4de;
  --section-ink: #0d0c12;
  --section-navy: #12141c;
  --radius-card: 32px;
  --radius-section: 48px;
  --radius-pill: 9999px;
}

@theme inline {
  --font-sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-serif: "Instrument Serif", Georgia, "Times New Roman", serif;
  --font-helveticaneue-bold:
    "HelveticaNeue-Bold", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --color-ink: var(--ink);
  --color-paper: var(--paper);
  --radius-card: var(--radius-card);
  --radius-section: var(--radius-section);
  --radius-pill: 9999px;
}

html {
  background: var(--paper);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-sans);
}
```

### Google Fonts link (layout.tsx)

```html
<link
  href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&display=swap"
  rel="stylesheet"
/>
```

### Bold file face

```css
@font-face {
  font-family: "HelveticaNeue-Bold";
  src:
    url("/BRAND_ASSETS/HelveticaNeue-Bold.otf") format("opentype"),
    local("Helvetica Neue Bold"),
    local("HelveticaNeue-Bold");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

### Hero + pill (conceptual)

```tsx
<section className="bg-paper px-6 py-20 md:px-12 md:py-28">
  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 sm:text-xs">
    API access
  </p>
  <h1 className="mt-4 max-w-[20ch] text-5xl font-helveticaneue-bold leading-[0.94] tracking-tight text-black md:text-7xl">
    Pay per token.{" "}
    <span className="font-serif italic font-normal">Nothing else.</span>
  </h1>
  <p className="mt-6 max-w-md text-base font-medium leading-relaxed text-black/70">
    Sign up, create a key at $0, and add credit when you are ready to run GLM-5.2.
  </p>
  <a
    href="/signup"
    className="pill-cta mt-8 inline-flex"
  >
    Create account
  </a>
</section>
```

### Tinted section returning to white

```tsx
<section className="bg-paper">
  <div className="rounded-t-[48px] bg-[var(--section-cream)] px-6 py-20 md:px-12 md:py-28">
    <h2 className="text-3xl font-bold tracking-tight text-black md:text-4xl">
      Models we host
    </h2>
    {/* cream cards, black type, white pills */}
  </div>
</section>
<section className="bg-paper px-6 py-20 md:px-12 md:py-28">
  {/* back on white */}
</section>
```

---

## Splash (implemented)

Hard refresh / full document load only. Not on client-side App Router navigations.

1. SSR `#luv13-splash` in `web/app/layout.tsx` — black full-viewport overlay, small `LUV13.png` (the PNG already reads on black via light outlines; do not invent a wordmark).
2. Inline critical CSS sets `html{background:#000}` so first paint is black before the CSS bundle.
3. `SplashScreen` waits for `document.fonts.ready` + `window` `load`, plus a **220ms** floor so a 0ms flash does not blink. Then adds `.is-exiting` (`transform: translateY(-100%)`, 700ms). Reduced motion: remove immediately.
4. After exit: `html.splash-done` → `--paper`. Overlay is removed from the DOM.

## Current vs remake (do not confuse)

| Before remake | Now (shipped) |
| --- | --- |
| `html` black, body transparent, full-page HLS video | White page; cream / rare ink section bands |
| Liquid-glass pills `bg-white/25` | Solid white `.pill-cta`, black hairline, regrow |
| Instrument Serif italic-only | Roman + italic |
| HelveticaNeue-Bold `local()` only | Also `url("/BRAND_ASSETS/HelveticaNeue-Bold.otf")` |
| shadcn `--primary` blue in tokens | Unused for marketing CTAs |
| `FlowButton` arrow slide | Marketing uses `PillCta` |

## Verification

- [ ] Headlines are Helvetica Neue Bold; emphasis words are Instrument Serif italic in ink.
- [ ] Logo is `LUV13.png`, not a recreated serif wordmark.
- [ ] Page background is white except section-owned bands (homepage hero is the red poster, not a white type block).
- [ ] All marketing CTAs are `rounded-full`, white, black type, 1px black border, regrow hover, `active:scale-[0.96]`.
- [ ] Copy names models, keys, credit, Cursor — not Hims medical products.
- [ ] `prefers-reduced-motion` disables pill scale/shadow.
- [ ] Contrast of ink on paper and ink on cream exceeds 4.5:1.

## Usage

- 2026-09-06: Created as the canonical LUV13 × Hims typography spec.
- 2026-09-06: Implemented remake + splash; deployed `luv13-web` on kor :3100. Logo PNG already reads on black. Local `rsync` missing — tar over SSH.
- 2026-09-06: Homepage hero became the red poster image (`hero-home.jpg` on `#fe0000`); HTML hero copy removed.
