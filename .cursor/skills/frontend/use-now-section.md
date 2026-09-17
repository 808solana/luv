---
name: use-now-section
description: Use when adding or editing the home-page Use Now section (Use With heading + full-bleed client marquee) after the model list.
created: 2026-09-08
updated: 2026-09-15
tags: [frontend, marketing, home, clients]
---

# Use Now section (home)

## When to Use
- Home section showing where to plug LUV13 in (agent / IDE clients)
- Changing the Use Now heading text or size, or the section's padding
- Reordering home sections around the model list
- Don't use when: dashboard setup docs, full integration guides, or the marquee's own internals (`client-marquee.md`)

## Steps
1. UI: `web/components/marketing/use-now.tsx` — heading is a **static** `<h2 id="use-now-heading">` reading **Use With**. Centered, HelveticaNeue-Bold, `text-xl sm:text-3xl md:text-4xl tracking-tight leading-tight` — the exact type scale the retired cycling slot used, so the heading is the same size as before. Then `<ClientMarquee />` (full-bleed, edge to edge). **Do not add a credit/footer line under the list** — the **facts by openrouter.com** credit was removed 2026-09-14 at the user's request, and `#models` has had no footer since the same date.
2. No motion on this heading. `web/components/ui/cycling-words.tsx` was **deleted 2026-09-14** and the skill is archived at `.cursor/skills/archive/cycling-words.md`. Do not bring back a rotating phrase slot, a constant `Luv with` line, or Cursor / Hermes / VS Code.
3. Client row: **`web/components/marketing/client-marquee.tsx`** (2026-09-15) — a full-bleed, auto-scrolling single row of marks + names. Data: `web/lib/client-providers.ts` (`{ id, name, src, href }`). Assets in `web/public/BRAND_ASSETS/clients/`. The card is an image and the name only — no kind ("Coding agent"), no Free / Free-and-Paid, no Open pill; the whole card links to the client's OpenRouter `/apps` page. The old stacked `provider-pane.tsx` list (and its 75px row scale locked to `model-pane.tsx`) was **deleted** 2026-09-15 — the lockstep rule is retired, `#models` keeps its own scale. Full recipe: `client-marquee.md`.
4. Wire on `web/app/page.tsx` **after** `ModelSlideshow`. The section has **no horizontal padding** — `px-6 md:px-12` is on the `<h2>` only, so the marquee reaches both viewport edges. Its bottom padding is **asymmetric on purpose** (2026-09-14): `pt-12 pb-[140px] md:pt-16 md:pb-[150px]` instead of `py-12 md:py-16`, because the home **contact form** (`Contact16`, zero top padding) follows it directly and this `pb` is the only spacer above it. History: it was first tuned as a *facts by openrouter.com* credit → form gap (`pb-16`/`pb-12` = 344/280px → `pb-10`/`pb-8` = 40/32px → +25% → `pb-10`/`md:pb-[50px]`); then the credit itself was **removed** (2026-09-14), leaving the last row as the section's last element; then the user asked for **+100px more**. Measured live at 3000: marquee bottom → **`Contact` heading top** is **150px desktop / 140px at 375px**. That target changed on 2026-09-16: the contact section gained a centered `Contact` `<h2>`, so this `pb` now measures to the *heading*, not the email field — the same `pb` yields marquee → email field **266px desktop / 225px at 375px** once the heading's line box + margin are counted. The `pb` values themselves were **not** touched by the heading. The footer after that supplies the page's bottom whitespace.
5. Keep anchor `id="use-now"` and hash `/#use-now`.
6. Do not bring back the three cream Client cards, the circular model-logo cloud, the UltraLight “Use luv13's Api Key & Base url” line, or a dumped animated-hero with launch/call buttons. (The infinite logo slider is now *live* again as the marquee — but via `client-marquee.tsx`, **not** `components/ui/infinite-slider.tsx`, which stays unused.)

## Current clients
- Cursor — `https://openrouter.ai/apps/url/https%3A%2F%2Fcursor.com%2F`
- Hermes — `https://openrouter.ai/apps/hermes-agent`
- VS Code — `https://openrouter.ai/apps/url/https%3A%2F%2Fcode.visualstudio.com%2F`
- FreeBuff — `https://openrouter.ai/apps/url/https%3A%2F%2Ffreebuff.com%2F`
- Open WebUI — `https://openrouter.ai/apps/open-webui`
- Kilo Code — `https://openrouter.ai/apps/kilo-code`
- Codex — `https://openrouter.ai/apps/codex`

(Row descriptors and the Free / Free-and-Paid split were dropped 2026-09-15; the retired values are recorded in `archive/provider-list.md`.)

## Pitfalls
- Do not put Luv With above the model stack or after base URL without an explicit reorder request.
- Public site: no internal provider names — only LUV13 + client product names.
- The heading is fully static: `use-now.tsx` is a **server** component — no `"use client"`, no motion branch, no `prefers-reduced-motion` handling (nothing moves up here). The marquee is its own client component. Keep it that way.
- Do not fill this row with Unsplash/lucide stock logos.
- Do not set UltraLight as `--font-sans`. Bold stays the body face. UltraLight is used **only** by the `#models` Neuralwatt heading now (the `#use-now` OpenRouter credit was removed 2026-09-14).
- Marks use `ShieldedImage`, not `<img>`. See `shielded-images.md`.
- Do not re-add row copy: the user asked for “just images with the name”, specifically without the “coding agent / personal agent” descriptors. Don't re-add an Open pill either — the card is the link.
- Do not add horizontal padding back to the `<section>` to "center" the slider: it must stay edge to edge. Pad the `<h2>` instead.
- **Do not move the marquee's card widths / gap into `use-now.tsx`.** `42vw` at mobile is what gives the user's "only two images or cards" — see `client-marquee.md`.
- Do **not** "restore symmetry" by changing `pt-12 pb-[140px] md:pt-16 md:pb-[150px]` back to `py-12 md:py-16`. The big bottom padding is deliberate: the home contact section sits directly below with **no top padding of its own**, so this `pb` *is* the marquee→contact gap (since 2026-09-16 it measures to that section's `Contact` heading; the contact section's own `mb-10`/`mb-8` supplies the heading→form gap). If the user asks again, move this `pb` — never re-add a credit line to change the spacing.
- The `pb` values aren't Tailwind steps (the scale jumps 40 → 48 → 56, and 140/150 sit between 36 and 96 on the arbitrary scale), so use bracket syntax: `pb-[140px]`, `md:pb-[150px]`. Don't silently round to the nearest step.
- This section is no longer the last thing on `/` — the contact section follows it (footer is still last). See `contact-form.md`.

## Verification
- [ ] Visible heading is the static text **Use With** (HelveticaNeue-Bold), centered, `text-xl sm:text-3xl md:text-4xl leading-tight`
- [ ] The marquee viewport spans the full width (`left 0 → right === innerWidth`) at 1920 **and** 375
- [ ] Seven clients, no descriptors, no Free/Paid, no Open pill; the card itself is the OpenRouter link
- [ ] No credit/footer line under the row
- [ ] `/#use-now` jumps to this section
- [ ] `#use-now` bottom === `#contact` top; marquee-bottom → **`Contact` heading top** is **150px desktop / 140px at 375** (the `pb`); marquee → email field is then **266px / 225px**
- [ ] `scrollWidth === innerWidth` at 375 (the marquee is clipped, not overflowing the page)
- [ ] `#use-now` contains zero `<img>` nodes

## Usage
- count: 27
- 2026-09-16: **no change to this section.** The contact section below it gained a centered `Contact` `<h2>` (`contact-form.md`), so the `pb-[140px] md:pb-[150px]` of `#use-now` now measures to that **heading** instead of the email field: re-measured live at 3000 — marquee bottom → heading top **150px desktop / 140px at 375px** (the `pb`, untouched), heading → email field 66px (the heading's own `mb-10`), i.e. marquee → email field **266px / 225px** overall. `#use-now` bottom === `#contact` top (452.9), `#contact` still `padding 0`, `scrollWidth === innerWidth` at both widths. Only the verification numbers in this skill changed.
- 2026-09-15: heading copy changed **Pair Models With** → **Use With** at the user's request. Text-only change: `use-now.tsx` `<h2>` content, same element/scale/padding/anchor. Docs updated in the same pass (`use-now-section.md`, `client-marquee.md`, `AGENT_MEMORY.md`, `PROJECT_CONTEXT.md`, `client-providers.ts` comment).
- 2026-09-15: the client row stopped being a stacked list. At the user's request ("too big, too long, and a bit ugly… just images with the name… span to the very left, to the very right… maybe on the mobile version there'll only be two images or cards") `provider-pane.tsx` was **deleted** and `use-now.tsx` now renders `ClientMarquee` — a full-bleed CSS-keyframe marquee of client marks + names. The section lost its `px-6 md:px-12` (moved onto the `<h2>`) so the row reaches both viewport edges. `kind` / `access` / `alt` were dropped from `client-providers.ts`; the card itself is now the OpenRouter link. **Retired the row-scale lockstep with `model-pane.tsx`** (see `model-slideshow.md`). Measured live at 3000: marquee bottom → email field still **176px desktop / 166px at 375px** (`pb` untouched), `#use-now` bottom === `#contact` top, `scrollWidth === innerWidth` at both widths, 7 a11y links (duplicates `inert`). New skill: `frontend/client-marquee.md`; `provider-list.md` archived; `infinite-slider.md` updated with why the CSS marquee was preferred over `InfiniteSlider`.
- 2026-09-14: removed the **facts by openrouter.com** credit, then bumped the list→form gap +100px at the user's request. `use-now.tsx`: deleted the `<p className="hero-neuralwatt mt-5 text-center">` block + its comment, and `pb-10 md:pb-[50px]` → `pb-[140px] md:pb-[150px]`. Measured live at 3000 (DevTools over CDP, desktop 1920 + 375 emulation): credit text absent from `body.innerText`, section ends at the Codex row, gap Codex→email **76 → 176px** desktop and **66 → 166px** at 375 (exactly +100 both), `#use-now` bottom === `#contact` top (3537), footer follows, `footer.bottom` ≈ `scrollHeight`, `scrollWidth === innerWidth` at both widths. prettier / tsc / eslint / build all 0. `.hero-neuralwatt` now has one consumer on the site: the `#models` heading.
- 2026-09-14: no code change here — the sibling `#models` list was raised to **this** section's row scale (`py-3.5` + 75px marks) at the user's request. **Superseded 2026-09-15: the marquee has no rows, so the two panes are no longer locked** — and the model pane then rescaled on its own, twice, ending at 60.375px marks / `py-[11.27px]` from `sm` up and 48.3px / `py-[9.016px]` below (`model-slideshow.md`).
- 2026-09-14: credit→form gap bumped +25% at the user's request (they now found it "a bit too close"): `pb-8 md:pb-10` → `pb-10 md:pb-[50px]`, i.e. 40 → 50px desktop and 32 → 40px at 375px. Only `#use-now`'s `pb` changed; the form and the footer's bottom whitespace are untouched.
- 2026-09-14: the home contact form was added directly below, so this section's padding became `pt-12 pb-8 md:pt-16 md:pb-10` (was `py-12 md:py-16`) and it stopped being the page's last section. The tightened bottom padding cut the *facts by openrouter.com* → email-field gap from 344px to 40px (desktop).
- 2026-09-14: this section became the home page's **last** section — the `#api` `Create account` / `Log in` strip was removed at the user's request (and the footer's API / Create account / Log in links were removed with it).
- 2026-09-14: moved **facts by openrouter.com** from above the provider list to below it (under Codex), `mt-5` instead of `mb-[30px]`.
- 2026-09-14: heading stopped cycling. Replaced `CyclingWords` (**Luv with everything down here** → **Thanks**) with static **Pair Models With** at the same type scale; deleted `cycling-words.tsx`; archived `cycling-words.md`.
