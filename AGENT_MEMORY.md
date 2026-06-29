# AGENT_MEMORY

## User Preferences & Conventions
- User wings it; brainstorm and explore before building.
- Direct, no filler. Prefers simple/simple/simple.
- LUV13 voice is "we", not founder-centric. Avoid autobiography about the founder.
- Treat `@BRAND_ASSETS` as the source of truth for logo and typography.
- Do not mention OpenRouter anywhere on the public site.

## Project Facts
- Project: **LUV13** — LLM hosting provider, launching with GLM-5.2.
- Workspace: `c:\Users\jgran\luv`.
- Existing: `.cursor\skills\`, `BRAND_ASSETS\`, `from-thinking-to-coding\`, `web\` (Next.js 16 app).
- App lives in `web/` — Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4.
- Routes: `GET /` (single page), `POST /api/notify` (email capture via Resend), `GET /api/health`.
- UI deps: `framer-motion` (animations), `lucide-react` (icons), `gsap` (installed but no longer used by the scroll-video background), `hls.js` (HLS source support — not exercised for local mp4, falls to direct src).
- Static assets served from `web/public/` (NOT repo-root `BRAND_ASSETS/`). Copy assets into `web/public/BRAND_ASSETS/` to make them reachable at `/BRAND_ASSETS/...`.
- `web/components/scroll-video-background.tsx`: FIXED full-page video background for the whole site (mounted in `layout.tsx`, not page.tsx). Uses a native passive `scroll` listener to set `video.currentTime = (scrollY / maxScroll) * duration`. No canvas, no frame cache, no mouse parallax, no zoom scaling. Loading overlay until `canplay`.
- Background video source in `layout.tsx`: self-hosted HD HLS `https://video.korgems.com/stream/index.m3u8` (5K@24fps, single 8s segment with B-frames). Was Mux HLS `https://stream.mux.com/LtB1WEO01Zzf2x...m3u8` (blurry due to top rendition 4K + auto-level selection), switched to self-hosted for sharpness. Local `backgroundyesyes.realesrgan.mp4` and earlier `filename*.m2ts/.m3u8` files no longer present in `web/public/BRAND_ASSETS/` (only `LUV13.png` and `typography.png` remain).
- Frame extraction cap is display-driven: `scale = min(1, innerWidth*dpr / videoWidth)` (dpr capped at 2), then clamped against a ~1GB decoded-frame budget. NOT the original fixed 1280. Extracting above display res is invisible; full 5K x ≤120 frames ≈ 7GB and crashes the tab.
- For the video to show site-wide: `body { background: transparent }`, `html { background:#000 }`, page root is `relative z-10`, and opaque section panels were made transparent / converted to `.liquid-glass`.

## Environment
- OS: Windows 10, PowerShell.
- Default new-project stack per repo: React / TypeScript / Tailwind frontend; Python or Node backend.
- FFmpeg installed via winget (`Gyan.FFmpeg`). Current shell may not see PATH immediately; binary path: `C:\Users\jgran\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe`.

## Tooling Notes
- `.cursor\skills\tooling\project-setup.md` is for the previous Love AI project, not LUV13. Do not follow it directly for this project.

## Lessons Learned
- Server Components in Next 16 App Router cannot receive event handlers (onMouseEnter etc.). Use pure CSS for hover states, or extract the interactive piece into a `"use client"` component.
- Don't hardcode anchors that don't exist — every nav `href="#..."` must point to a real `id` on the page, or it silently no-ops.
- The "no OpenRouter on public site" constraint is easy to violate in feature copy. Re-check feature/checklist text against it before finishing.
- `backgroundyesyes.mp4` is a local mp4, NOT a Mux/HLS stream — hls.js isn't exercised for it; the direct `video.src` path runs. Keep hls.js dynamic-imported so mp4 doesn't pay for it.
- Scroll-scrubbed video: current user preference is native passive `scroll` listener driving `video.currentTime` directly. No GSAP ScrollTrigger, no canvas/frame-cache, no mouse parallax, no zoom scaling. If direct seeking is still choppy, the real fix is re-encoding the source with dense keyframes / short GOP + multi-segment HLS (`ffmpeg -i in.mp4 -g 1 -c:v libx264 -f hls -hls_time 1 -hls_playlist_type vod out.m3u8`), NOT more JS. Confirmed in real bug: a single 8s `.ts` at 5120x2880 with B-frames was choppy on scrub; Mux's multi-segment multi-bitrate rendition was smooth. Dense keyframes + short segments lets the browser seek cheaply and decode small chunks.
