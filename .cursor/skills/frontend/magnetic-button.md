---
name: magnetic-button
description: Use when adding a mild magnetic hover follow to a compact control (Open pills). White pill, black type; clamp travel to the parent row so neighbors do not overlap.
created: 2026-09-12
updated: 2026-09-12
tags: [frontend, marketing, motion]
---

# Magnetic button

## When to Use
- Open pills on `#use-now` (and later, any compact bordered pill that should follow the pointer)
- Don't use when: large CTAs (`.pill-cta`), forms, or anything that must stay still for clicking accuracy on touch

## Steps
1. Primitive: `web/components/ui/magnetic-button.tsx` (`framer-motion` already in `web/`).
2. Wrap the existing `<a>` / `<button>`. Do not restyle the child to indigo/blue. Site Open pills stay `bg-white text-black border-black`.
3. Keep `distance` mild (`0.28` default). Stronger values cross row dividers.
4. Put `data-magnetic-bounds` + `overflow-hidden` on the **row** (`role="listitem"`). The button clamps to that box so Cursor’s Open cannot drift into Hermes.
5. Honor `prefers-reduced-motion`: no follow, snap stays at rest.

## Pitfalls
- Do not paste the 21st.dev / shadcn demo `bg-indigo-500` button.
- Do not install `framer-motion` again — it is already a dependency.
- Measure rest position minus current `x`/`y`. `getBoundingClientRect()` includes the live transform and will chase itself.
- Do not magnetize the whole row. Hover target is the Open pill only.
- Do not let travel ignore the divider. Clamp + `overflow-hidden` on the list item.

## Verification
- [ ] Open pills are white with black type
- [ ] Hover follows the pointer slightly
- [ ] A pill never crosses into the next provider row
- [ ] Reduced motion: no translation

## Usage
- count: 1
