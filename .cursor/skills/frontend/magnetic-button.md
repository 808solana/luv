---
name: magnetic-button
description: Use when adding a mild magnetic hover follow to a compact control (Open pills). White pill, black type; clamp travel to the parent row so neighbors do not overlap.
created: 2026-09-12
updated: 2026-09-16
tags: [frontend, marketing, motion]
---

# Magnetic button

## When to Use
- Open pills on `#use-now` (and later, any compact bordered pill that should follow the pointer) — the `#models` Open pill is the third consumer (2026-09-16).
- Don't use when: large CTAs (`.pill-cta`), forms, or anything that must stay still for clicking accuracy on touch

## Steps
1. Primitive: `web/components/ui/magnetic-button.tsx` (`framer-motion` already in `web/`). **Do not paste the 21st.dev / shadcn `magnetic-button.tsx` demo** — the in-repo one already adds reduced-motion handling, a rest-position capture, and optional clamping.
2. Wrap the existing `<a>` / `<button>`. Do not restyle the child to indigo/blue. Site Open pills stay in the site pill family (`bg-white text-black border-black`, or `.liquid-glass-pill` on the light band — see `liquid-glass-card.md`).
3. Keep `distance` mild (`0.28` default) for controls that have neighbours. Stronger values cross row dividers.
4. Put `data-magnetic-bounds` + `overflow-hidden` on the **row** (`role="listitem"`). The button clamps to that box so Cursor’s Open cannot drift into Hermes.
   - **Deviation, 2026-09-16 (`#models` Open pill): skip `overflow-hidden`.** The clamp alone is sufficient *when the travel is already smaller than the slack* — measured there, the natural bound is ~6.7px (`0.28 × 24px` of hit box) against 11.3px of slack below the pill, so the clamp never even engages and `overflow-hidden` would only clip the focus ring. Add `overflow-hidden` only if the travel can actually reach the row edge (i.e. `distance × hit-box` exceeds the slack).
5. Honor `prefers-reduced-motion`: no follow, snap stays at rest.
6. **Standalone controls** (no row, e.g. the home contact form's `.circle-cta` send button) can take a stronger `distance` — `0.45` is used there — because there is nothing to collide with and the hover box *is* the control, so travel stays modest. Measured on a 56px circle: a pointer 22px/18px off-center moves the circle ~9.9px/8.0px. Without `data-magnetic-bounds` the offsets are unclamped, which is safe here only because `onMouseMove` can fire solely while the pointer is over the control.
7. **The wrapper is a real `<div>` in the layout — pass the sizing utilities through `className`.** `MagneticButton` renders `motion.div` with `cn("inline-flex", className)`, so it becomes the flex item where the `<a>` used to be. Give it whatever the child had that the parent's layout depends on (`shrink-0`, `w-*`, margins) and re-measure — the wrapper should be **exactly the child's box**. On the `#models` pill it measured identical to the pill at both 375 and 1920, and the row heights did not move by a tenth of a pixel.

## Pitfalls
- Do not paste the 21st.dev / shadcn demo `bg-indigo-500` button.
- Do not install `framer-motion` again — it is already a dependency.
- Measure rest position minus current `x`/`y`. `getBoundingClientRect()` includes the live transform and will chase itself.
- **Never trust `rest.current` without checking it was captured.** It initialises to all zeros, and `apply()` is reachable from `onMouseMove` alone. If a move ever arrives without a preceding `onMouseEnter`, the naive `(clientX - 0) * distance` translates the element by `distance × clientX` — a page-flinging jump (reproduced: 544px). `captured.current` guards this and is reset on leave so each hover re-captures a fresh rest box.
- **Do not magnetize the whole row. Hover target is the Open pill only.**
- **Do not let travel ignore the divider. Clamp + `overflow-hidden` on the list item** — unless the measured travel is already well inside the slack (then clamp only; see step 4).
- **A moving target must still be clickable:** magnetism moves the control *toward* the pointer, so the click point stays on it. Don't add a magnet to a control whose hit area is smaller than its travel.

## Verification
- [ ] Open pills are in the site pill family (white/black, or `.liquid-glass-pill` on a light band — never indigo/blue)
- [ ] Hover follows the pointer slightly (dispatch a `mousemove` ~20px off centre: the wrapper translates by ≈`distance ×` the offset)
- [ ] A pill never crosses into the next provider row
- [ ] The wrapper measures **exactly** the child's box and the surrounding layout is unchanged (row heights, no new overflow)
- [ ] Reduced motion: no translation (`transform: none` with `prefers-reduced-motion: reduce`)
- [ ] Leaving the control returns it to ~0
- [ ] A pointer far from the rest box never produces a large translate (drop a `mousemove` on the wrapper with no `mouseover` first — the element must not fling)

## Usage
- count: 3
- 2026-09-16: third consumer — the `#models` **Open pill** (`web/components/marketing/model-pane.tsx`, `distance` default `0.28`, `data-magnetic-bounds` on the `<article>`, `shrink-0` on the wrapper). Asked for in the same breath as the liquid-glass surface (*"can we make the pill with the liquid glass effect and in addition to taht can we make the pill have the magnetic effect"*), which is why the pill's hover ring now lives in CSS with the surface — see step 4's `overflow-hidden` deviation and `liquid-glass-card.md`. Verified by dispatching synthetic `mouseover`/`mousemove`/`mouseout` (CDP `Input.*` is denied, but React's delegated handlers fire on bubbling `MouseEvent`s): a move 20px/9px off-centre translated the wrapper **5.5px/2.3px**, leave returned `transform: none`, reduced motion left the wrapper `transform: none` outright. Note the synthetic `mouseover` did **not** trigger React's `onMouseEnter` (no real `relatedTarget` bookkeeping) — the follow still worked, which incidentally re-confirms the `captured.current` guard: `apply()` called `captureRest()` itself instead of reading the zeroed initial `rest` and flinging the pill.
- 2026-09-14: second consumer — the home contact form's `.circle-cta` send button (`distance={0.45}`, standalone, no `data-magnetic-bounds`). Hardened the primitive with the `captured` ref after reproducing a 544px fling from a move-without-enter. Documented the standalone `distance` deviation in step 6. See `contact-form.md`.
- 2026-09-12: created for the `#use-now` Open pills.
