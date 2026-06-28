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
- UI deps: `framer-motion` (animations), `lucide-react` (icons).

## Environment
- OS: Windows 10, PowerShell.
- Default new-project stack per repo: React / TypeScript / Tailwind frontend; Python or Node backend.

## Tooling Notes
- `.cursor\skills\tooling\project-setup.md` is for the previous Love AI project, not LUV13. Do not follow it directly for this project.

## Lessons Learned
- Server Components in Next 16 App Router cannot receive event handlers (onMouseEnter etc.). Use pure CSS for hover states, or extract the interactive piece into a `"use client"` component.
- Don't hardcode anchors that don't exist — every nav `href="#..."` must point to a real `id` on the page, or it silently no-ops.
- The "no OpenRouter on public site" constraint is easy to violate in feature copy. Re-check feature/checklist text against it before finishing.
