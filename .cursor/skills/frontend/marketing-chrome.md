---
name: marketing-chrome
description: Use when adding or changing the marketing sticky header or sparse multi-column footer. Transparent header, no logo in chrome, LEV 13 copyright, a single Dashboard link in the top nav (both desktop and mobile).
created: 2026-09-13
updated: 2026-09-13
tags: [frontend, marketing, header, footer, nav]
---

# Marketing header + footer

## When to Use
- Changing site chrome on `MarketingShell` pages (`/`, `/models`, `/terms`, `/privacy`)
- Sticky transparent header or footer columns
- Don't use when: dashboard, login/signup `AuthShell` (those keep their own chrome)

## Steps
1. Chrome lives in `web/components/marketing/site-header.tsx` and `site-footer.tsx`, mounted from `marketing-shell.tsx`. Do not revive deleted `overlay-menu.tsx` / old `site-header.tsx` blindly.
2. Header is `fixed` and **always transparent** — no white/pale slab, no bottom hairline. Height token: `--site-header-height` (3.5rem). Home uses `overlayHeader` so the red hero sits under the nav (existing `pt-24` on the mark). Other marketing pages pad with `pt-[var(--site-header-height)]`.
3. **No logo in the header.** One link only, right-aligned, at every width: **Dashboard** (`/keys` → redirects to `/dashboard`, or `/login` if signed out). Ink type; **no text-shadow** — the white offset shadow smears/discolors when colored sections (red hero, chart bars) scroll behind the fixed transparent nav. Plain `text-ink` reads fine on both white and red.
4. **No hamburger, no mobile menu.** The single Dashboard link is shown identically on desktop and mobile, so `SiteHeader` is a plain (non-client) component with no state, no overlay, and no Escape/scroll-lock effect. Do not reintroduce the burger button.
5. Footer: five sparse columns (Models / Product / Company / Legal / Connect) plus **LEV 13 © 2026** in `text-black/40`. Legal is real `/terms` and `/privacy` placeholders (must not 404). Connect only uses URLs already in the product (Neuralwatt) — do not invent social profiles.
6. Hash jumps: keep `HomeHashScroll`; Lenis `scrollTo` offset ~`-72` so sections clear the fixed header. Section `scroll-mt-[calc(var(--site-header-height)+0.75rem)]`.
7. Type: HelveticaNeue-Bold. Do not use UltraLight in the header/footer.

## Pitfalls
- Do not copy Thinking Machines (or anyone else's) labels, legal copy, or assets. Layout pattern only.
- Do not paint the header white. Do not put `LUV13.png` or a wordmark in the header.
- The Models nav link was removed; do not add it back. `#models` is still reachable by scrolling / footer, just not from the header.
- Chrome `--window-size` does not always set CSS viewport; verify mobile with CDP `Emulation.setDeviceMetricsOverride` (width 390) and check `.site-header button` count is 0.
- `/keys` is a compatibility redirect, not a new keys app; the label is purely cosmetic.

## Verification
- [ ] Desktop `/`: transparent sticky nav, single **Dashboard** link, no logo, no Models
- [ ] Dashboard goes `/keys` → `/dashboard` (or `/login` when signed out)
- [ ] Mobile (390px): same single **Dashboard** link, **no** hamburger, no overlay; `.site-header button` count is 0
- [ ] Footer columns + `LEV 13 © 2026`; `/terms` and `/privacy` 200

## Usage
- count: 3
