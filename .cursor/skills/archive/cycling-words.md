---
name: cycling-words
description: Use when adding a vertical cycling phrase in a headline (Use Now, hero lines). Spring-slide one phrase at a time; do not paste the full shadcn animated-hero demo.
created: 2026-09-11
updated: 2026-09-13
tags: [frontend, marketing, motion]
---

# Cycling words

## When to Use
- A headline needs one slot that rotates phrases
- Don't use when: you need the shadcn animated-hero with launch article / call / signup buttons

## Steps
1. Primitive: `web/components/ui/cycling-words.tsx` (`framer-motion` already in `web/`).
2. Pass `words` in display order. Home `#use-now` uses `intervalMs={3000}` (3s hold). Primitive default stays 2000ms for other callers.
3. Home `#use-now` has **no static lead-in**. The slot *is* the heading: **Luv with everything down here** → **Thanks**. Do not stack a constant `Luv with` line. Do not restore Cursor / Hermes / VS Code.
4. Center every word in the slot (`justify-center text-center`). Pass `className="w-full"` so the slot shares the heading axis. Short phrases (`Thanks`) stay centered inside the longest-phrase spacer. On `#use-now`, the OpenRouter facts credit sits *under* this slot, not inside it.
5. Honor `prefers-reduced-motion`: freeze on the first word, no spring.
6. Slide spring: `{ type: "spring", stiffness: 32, damping: 16 }`. Hold (`intervalMs`) is separate from slide speed.

## Pitfalls
- Absolute words collapse the slot unless an invisible longest-word spacer (or `w-full`) gives it size.
- Do not snap the slide back to stiffness 50 / damping 14. `#use-now` hold is 3000ms and is separate from slide speed.
- Do not put a static lead-in and the slot on one baseline row. The spacer is as wide as the longest phrase, so a short word on the same row sits left of page center.
- Do not use `sm:justify-start sm:text-left` on the animated words — that left-aligns short phrases inside the wide slot.
- Variable-length phrases: long phrases wrap on small screens (`h-[2.4em]`); `sm+` stays one nowrap line.
- Do not dump `animated-hero.tsx` Button / lucide chrome onto marketing pages.

## Verification
- [ ] Words enter from below and leave upward
- [ ] The current word is centered on the page
- [ ] Heading does not jump in height
- [ ] Hold is ~3s on `#use-now` before the next phrase
- [ ] Slide is a bit slower/heavier (stiffness 32 / damping 16), not snappy
- [ ] Reduced motion shows the first word only

## Usage
- count: 7
