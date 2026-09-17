---
name: cycling-words
description: Archived 2026-09-14. The #use-now heading is now static text ("Pair AI Models With ..."), so the rotating phrase slot and its primitive are retired. Kept for the vertical-slide notes if a cycling headline ever returns.
created: 2026-09-11
updated: 2026-09-14
status: stale
tags: [frontend, marketing, motion, archive]
---

# Cycling words (removed)

**Removed 2026-09-14.** The `#use-now` heading used to rotate **Luv with everything down here** → **Thanks** on a 3s hold. The user asked to drop the effect and keep the same text size, so the heading is now a plain static `<h2>` and `web/components/ui/cycling-words.tsx` was **deleted**. `CyclingWords` has no consumers anywhere in the app. Do not re-add a cycling headline without an explicit request.

Below is the retired implementation, kept because the slot-sizing pitfalls still apply to any "one slot, many phrases" headline.

## When this applied

- A headline needed one slot that rotates phrases.
- **Did not apply to:** the shadcn animated-hero with launch article / call / signup buttons.

## Steps (retired)

1. Primitive was `web/components/ui/cycling-words.tsx` (`framer-motion`, already in `web/`).
2. `words` were passed in display order; `#use-now` used `intervalMs={3000}` (3s hold), the primitive default was 2000ms.
3. The slot *was* the heading — there was no static lead-in line before the first phrase.
4. Every phrase was centered in the slot (`justify-center text-center`), with `className="w-full"` so the slot shared the heading axis. Short phrases (`Thanks`) stayed centered inside the longest-phrase spacer.
5. `prefers-reduced-motion` froze the slot on the first word, with no spring.
6. Slide spring was `{ type: "spring", stiffness: 32, damping: 16 }`; the hold (`intervalMs`) was separate from slide speed.

## Pitfalls

- Absolute words collapse the slot unless an invisible longest-word spacer (or `w-full`) gives it size.
- Do not snap the slide back to stiffness 50 / damping 14. The hold is separate from slide speed.
- Do not put a static lead-in and the slot on one baseline row. The spacer is as wide as the longest phrase, so a short word on the same row sits left of page center.
- Do not use `sm:justify-start sm:text-left` on the animated words — that left-aligns short phrases inside the wide slot.
- Variable-length phrases: long phrases wrapped on small screens (`h-[2.4em]`); `sm+` stayed one nowrap line.
- Do not dump `animated-hero.tsx` Button / lucide chrome onto marketing pages.

## What replaced it

`web/components/marketing/use-now.tsx` — plain `<h2 id="use-now-heading">Pair Models With</h2>` with the same type scale (`text-xl sm:text-3xl md:text-4xl`, `font-helveticaneue-bold tracking-tight`) and `leading-tight` so the line box matches the retired slot. Spec: `.cursor/skills/frontend/use-now-section.md`.

## Usage

- count: 7 (retired)
