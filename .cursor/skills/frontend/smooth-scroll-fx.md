---
name: smooth-scroll-fx
description: Use when adding buttery page scroll and simple scroll-linked motion on desktop + mobile. Lenis for fine pointers only; native compositor scroll on touch.
created: 2026-09-08
updated: 2026-09-13
tags: [frontend, scroll, lenis, motion, mobile]
---

# Smooth scroll + simple hero FX

## When to Use
- Marketing pages that need smooth **wheel** scroll without heavy GSAP timelines.
- A single hero that should gently rise/fade as the user scrolls past the first screen.
- Any time a phone reports “choppy” scrolling while desktop feels fine.

## Steps
1. Keep `SmoothScroll` in root `layout.tsx` (Lenis is a dependency).
2. **Boot Lenis only for fine, hover-capable pointers** — `(hover: hover) and (pointer: fine)`.
   - Touch devices get **no Lenis instance at all**: no rAF loop, no listeners. Native iOS/Android
     momentum scroll is compositor-driven and is already the smoothest scroll available.
   - Even on hybrid touchscreen laptops, set `syncTouch: false` so a finger always uses native scroll.
3. Lenis config that works well for desktop wheel:
   - `duration: ~1.15`, expo-out easing
   - `smoothWheel: true`, `wheelMultiplier: ~0.92`
   - `syncTouch: false`
   - Toggle `html.lenis` / `lenis-smooth` classes; CSS disables native `scroll-behavior` under Lenis.
   - Set `document.documentElement.dataset.scroll` (`lenis` | `native-touch` | `reduced`) for debugging.
4. Skip Lenis entirely when `prefers-reduced-motion: reduce`.
5. Keep hash jumps working for both modes: when `.lenis` is absent, `scrollIntoView({ behavior: "smooth" })`
   still respects `scroll-mt-*` (see `home-hash-scroll.tsx`).
6. **Pause always-running JS animations when offscreen or the tab is hidden.** A continuous rAF loop
   (e.g. `InfiniteSlider` marquee) that keeps running while you read another section steals main-thread
   frames and makes scroll stutter on phones. Use an `IntersectionObserver` + `visibilitychange` and call
   the framer-motion controls' `.pause()` / `.play()` (never `.stop()`, which loses position).
7. For hero FX, wrap content in a client component that:
   - Maps `scrollY / (0.72 * innerHeight)` → progress 0–1
   - Lerps progress in rAF (`current += (target - current) * 0.12`)
   - Applies `translate3d` + slight `scale` + `opacity` only (GPU-friendly)
8. Never use `transition: all`; only transform/opacity.

## Pitfalls
- **`syncTouch: true` is what makes mobile choppy.** It prevents the native gesture and drives `scrollTo`
  from the main thread every frame, so any other JS animation makes it stutter. iOS native momentum beats
  any JS touch smoothing — do not “add” smoothing that hijacks touch.
- Assuming desktop smoothness implies mobile smoothness — mobile CPUs are ~10× slower; main-thread
  animation cost that is invisible on desktop drops frames on a phone.
- Leaving an off-screen infinite animation running during scroll.
- Forgetting reduced-motion opt-out.
- Scrubbing many DOM nodes per frame — keep one wrapper layer.
- `scrollTo` without `resize()` after a layout change stays at y=0 (Lenis mode).

## Verification
- [ ] Desktop: `document.documentElement.dataset.scroll === "lenis"`, wheel feels continuous
- [ ] Emulated iPhone (`Emulation.setDeviceMetricsOverride` + `setTouchEmulationEnabled`):
      `dataset.scroll === "native-touch"`, no `lenis` class
- [ ] Marquee transform advances while the hero is on screen, holds still when scrolled away, resumes on return
- [ ] Hash jump (`#models`) lands with the target at its `scroll-mt` offset
- [ ] `prefers-reduced-motion` → no Lenis, no FX

## Usage
- 2026-09-08: home `luv13.ai` hero + sitewide Lenis tune
- 2026-09-08: lock/unlock + resize for home hero gate
- 2026-09-13: **corrected** — dropped `syncTouch`; Lenis is now desktop-wheel only, mobile is native.
  Marquee (`InfiniteSlider`) pauses offscreen / tab-hidden. Fixed reported iPhone choppiness.
