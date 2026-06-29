---
name: scroll-scrubbed-video
description: Use when a video should be the fixed background for an entire site and scrub frame-by-frame with native page scroll (top = first frame, bottom = last).
created: 2026-06-28
updated: 2026-06-28
tags: [frontend, video, scroll, nextjs]
---

# Full-Page Scroll-Scrubbed Video Background

## When to Use
- The video must sit behind the WHOLE page, fixed, and advance as the user scrolls the document.
- Don't use when: you only want a video in one section (scope it to that section instead) or a simple autoplay loop.

## Approach (direct video + native scroll seek)
1. `"use client"` component rendering `pointer-events-none fixed inset-0 z-0` with a single `<video muted playsInline preload="auto" className="object-cover h-full w-full">`. Show the video DIRECTLY (native resolution = crisp; no canvas upscaling blur).
2. Mount it in `layout.tsx` (NOT page.tsx) so it's behind every route.
3. Scroll → progress: `maxScroll = document.documentElement.scrollHeight - window.innerHeight`; `progress = window.scrollY / maxScroll`; `targetTime = progress * video.duration`.
4. In a native passive `scroll` listener, set `video.currentTime = targetTime` only when `!video.seeking`.
5. Do not add GSAP ScrollTrigger, mouse parallax, zoom scaling, canvas, or frame caching unless the user explicitly asks.

## Why NOT the canvas ImageBitmap frame-cache
It seems "smoothest" but: (a) frames capped at a low width (e.g. 1280) get upscaled onto a DPR-scaled full-viewport canvas → **blurry**; (b) only 30–120 frames spread over a multi-screen scroll → **choppy** stepping; (c) native-res × many frames = **gigabytes** of RAM. Direct-video + eased seek avoids all three.

## Make it visible site-wide (critical)
- `body { background: transparent }` and `html { background:#000 }` (fallback while decoding).
- Page root: `relative z-10` so content sits above the `z-0` background.
- Convert opaque section backgrounds (`bg-white`, gradients, solid panels) to transparent. For legibility over video, wrap text blocks in `.liquid-glass` instead of solid fills. No full-frame tint overlay (keeps "no overlay" requirement).

## Pitfalls
- Next.js serves from `web/public/`; copy repo-root assets into `web/public/BRAND_ASSETS/`.
- A single opaque ancestor (`body{background:#fff}`, page `bg-white`) hides the whole effect — hunt them all down.
- If direct seeking is still choppy, the real fix is re-encoding the source for cheap seeks — dense keyframes (every frame, `-g 1`), short HLS segments (`-hls_time 1`), and ideally a multi-bitrate ladder (`-var_stream_map`/`master.m3u8`) so the browser can scrub small cheap chunks. NOT more JS. Confirmed real-world: Mux's multi-rendition short-segment stream scrubs smoothly; a single 8-second 5K `.ts` with B-frames is choppy because the decoder must walk the B-frame chain from the lone keyframe to decode each seek target.
- Blur usually = source resolution lower than the (DPR-scaled) display, or an upscaling canvas. Direct video at native res is the sharpest you can get without a higher-res source. But: an over-large source (e.g. 5K) on a 4K-class display doesn't add visible sharpness and costs decode time per seek — match the source resolution to your max display, typically 3840x2160 for retina fullscreen.

## Verification
- [ ] `npm run build` exits 0.
- [ ] At top of page video shows first frame; scrolling to bottom reaches the end of the clip.
- [ ] Video is visible behind every section, not just one.
