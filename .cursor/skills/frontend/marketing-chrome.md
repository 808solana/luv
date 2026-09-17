---
name: marketing-chrome
description: Use when adding or changing the marketing sticky header or the footer directory. Transparent header, no logo in chrome, footer directory currently EMPTY (no headers, no links), a single Dashboard link in the top nav (both desktop and mobile).
created: 2026-09-13
updated: 2026-09-14
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
5. Footer is an **empty directory scaffold** (2026-09-14). `COLUMNS: readonly FooterColumn[]` in `site-footer.tsx` is currently `[]`, so `<footer>` renders as one empty padded wrapper: no headers, no links, no Instagram, no copyright. All of it was removed at the user's request — they had already gutted the links, then asked for the headers gone too ("even Instagram, everything is going to be gone").
   - The container API is deliberately kept as the extension point: `COLUMNS` holds `{ title, links }` (`FooterColumn`), each link is `{ href, label, external? }` (`FooterLink`). Internal links render through `next/link`, `external: true` renders a plain anchor with `target="_blank" rel="noreferrer"`. Re-adding a column is a data-only edit — push an object into `COLUMNS`; do not restructure the component or re-add removed markup.
   - The header disappeared with the columns. Do **not** re-create standalone header markup, and do **not** restore the historical labels: Contact's **Instagram** (`https://www.instagram.com/luv13ai`), the old Models column (Hosted models / Directory / Kimi K3 / GLM 5.3 / DeepSeek V4.1 Flash), Product (`Use now`), Company (Home / Infrastructure), Legal (Terms / Privacy), Connect (Neuralwatt).
   - **Do not change or re-add the Instagram URL** unless the user asks. It was `luv13ai`, not `luv13` — confirmed explicitly 2026-09-14; a one-character "fix" points at someone else's account.
   - **No divider/hairline in the footer.** The inner container used to carry `border-t border-black/10` above the columns; removed 2026-09-14. The footer is an open, borderless block (`<div className="mx-auto max-w-7xl pt-14">`). No `<hr>`, no `border-t`/`border-b`, no gradient background line.
   - The **LEV 13 © 2026** line is gone. Do not re-add it (or any replacement copyright/legal line) unless asked.
   - Because the directory is empty, `/models`, `/terms`, and `/privacy` are currently **unlinked from the footer**. That is intended — do not "fix" it by inventing links.
   - The empty `<footer>` still carries its spacing classes, so the page ends in a ~200–232px blank strip below the last section. That is the current, accepted state; only change it if the user asks (see Pitfalls).
   - The `<footer>` **is now the last element** on every page including `/` (2026-09-14). An earlier same-day pass moved the home contact form below it via a `MarketingShell afterFooter` slot; the user then said the resulting gap above the form was "way too big", so the slot was **deleted** and the contact form moved into `page.tsx`'s `<main>` right after `#use-now`. The footer's blank padding is therefore the page's bottom whitespace and the credit→form gap is owned by `#use-now`'s `pb`. See `frontend/contact-form.md`.
6. Hash jumps: keep `HomeHashScroll`; Lenis `scrollTo` offset ~`-72` so sections clear the fixed header. Section `scroll-mt-[calc(var(--site-header-height)+0.75rem)]`.
7. Type: HelveticaNeue-Bold. Do not use UltraLight in the header/footer.

## Pitfalls
- Do not copy Thinking Machines (or anyone else's) labels, legal copy, or assets. Layout pattern only.
- Do not paint the header white. Do not put `LUV13.png` or a wordmark in the header.
- The Models nav link was removed; do not add it back. `#models` is reachable by scrolling (and was previously reachable from the footer, which no longer links it).
- Chrome `--window-size` does not always set CSS viewport; verify mobile with CDP `Emulation.setDeviceMetricsOverride` (width 390) and check `.site-header button` count is 0.
- Do not re-add a rule/hairline above the footer columns. The user called it "the little divider line" and asked for it gone (2026-09-14); re-adding `border-t` on the footer inner div is a regression. Verify by asserting every `footer, footer *` element has `border-top-width`/`border-bottom-width` of `0` and `background-image: none`.
- The footer directory is **intentionally empty**. Do not add headers, links, socials, or placeholders unless the user explicitly names them. Never "fill it in" with plausible-sounding labels (About, Careers, Twitter, …).
- Do not resurrect a footer header (`Contact`, `Product`, …) as standalone markup. Headers only ever came from `COLUMNS[].title`; if the user asks for a header back, add the column object, don't hand-write a `<p>`.
- Re-adding the **Instagram** entry means `{ href: "https://www.instagram.com/luv13ai", label: "Instagram", external: true }` under a column titled `Contact` — the same shape and the same handle, not a new guess.
- Do not re-add the footer copyright line. It was removed on purpose; the footer ends after the columns.
- The empty `<footer>` still contributes ~200px (375px viewport) to ~232px (1920px) of blank space below the last section because it keeps `pb-16 pt-20` + `pt-14`. That is expected — **do not** silently "clean up" the trailing whitespace, and do not delete the `SiteFooter` render either. Only collapse the padding or drop the footer element if the user asks for that specifically. On `/` that strip is the whole page bottom (the contact form sits **above** the footer), so shrinking this padding shortens the page's bottom whitespace.
- Do not reintroduce a `MarketingShell afterFooter` slot to push content below the footer. It existed for one pass on 2026-09-14 and was removed the same day, because putting the home contact form after the footer buried it under ~232px of blank padding — the exact gap the user then asked to shrink. `FooterColumn`/`FooterLink`/`COLUMNS` are unchanged and still the only footer API.
- `/keys` is a compatibility redirect, not a new keys app; the label is purely cosmetic.

## Verification
- [ ] Desktop `/`: transparent sticky nav, single **Dashboard** link, no logo, no Models
- [ ] Dashboard goes `/keys` → `/dashboard` (or `/login` when signed out)
- [ ] Mobile (390px): same single **Dashboard** link, **no** hamburger, no overlay; `.site-header button` count is 0
- [ ] Footer renders **nothing** — `footer.innerText === ""`, `footer.querySelectorAll('a, p, li').length === 0`, and no `a[href*="instagram"]` anywhere on the page
- [ ] Footer has **no** divider line (no element inside `footer` has a top/bottom border or background-image)
- [ ] Footer is the last element on `/` too: `#contact.bottom` ≈ `footer.top` and `footer.bottom` ≈ `document.documentElement.scrollHeight`
- [ ] 375px: no horizontal overflow (`documentElement.scrollWidth === innerWidth`) — the empty footer gave `scrollWidth 375` on 2026-09-14

## Usage
- count: 9
- 2026-09-14 — footer is last again: the home contact form moved from after the footer to just after `#use-now`, and the `MarketingShell afterFooter` slot was deleted (the gap it created was the thing the user asked to shrink). Footer padding untouched.
- 2026-09-14 — footer directory emptied entirely: headers + Instagram entry removed, `COLUMNS = []`, scaffold API kept.
