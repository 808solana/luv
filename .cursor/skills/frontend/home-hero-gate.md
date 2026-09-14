---
name: home-hero-gate
description: Use when changing the home hero. Visitors land already in — no enter gate, no “AI models now” pill. Free scroll from first paint.
created: 2026-09-08
updated: 2026-09-13
tags: [frontend, home, hero, scroll]
---

# Home hero (ungated)

## When to Use
- Changing `/` hero copy, layout, or what sits below the fold.
- Hash links `#models` / `#use-now` / `#api` / `#pricing`.
- Don't use when: dashboard or auth pages.

## Steps
1. Home is **open on first paint**. Do not wrap in a click-to-enter gate. Do not hide Models / Use Now / API.
2. Hero is the `luv13` mark only (HelveticaNeue-Bold), compact — not `min-h-dvh`. Solid brand red `#fe0000` (`.home-hero-frame`); invert the mark to `--paper`. No pale wash, no poster image, no `.ai` suffix and no period. **Infrastructure by Neuralwatt.com** is the `#models` heading on the white page below a kept gap. **No** “AI models now” (or any other) enter button.
3. Keep `HomeHashScroll` so `/` hash links Lenis-scroll to the section. Chrome is a single **Dashboard** link (`/keys`) at every width — no header Models link, no mobile hamburger/overlay. Native `scrollIntoView` fallback if the target is still >120px from the top.
4. `SmoothScroll` stays running on `/` (no `html.home-gated`, no `lenis.stop()`). `resize()` before `scrollTo` for hash jumps.
5. Account CTAs stay on the API strip (`/signup`, `/login`) — never on the hero.

## Pitfalls
- Do not re-add a hero enter pill. Visitors must be able to scroll past the hero immediately.
- `pushState` does not fire `hashchange`; `HomeHashScroll` handles click + `popstate` itself.
- Do not `preventDefault` on window `touchmove`.

## Verification
- [ ] `/` shows the hero and the rest of the page without a click
- [ ] No “AI models now” control on the hero
- [ ] Models, Use Now, and base URL are reachable by scrolling from land
- [ ] Hash links `/#models` / `/#use-now` / `/#api` jump to those sections
- [ ] `prefers-reduced-motion` still lands on the section (native scroll)

## Usage
- count: 11
