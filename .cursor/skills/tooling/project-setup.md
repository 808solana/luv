---
name: project-setup
description: Use when initializing the Love AI project or onboarding to this codebase. Documents project structure and dev environment.
created: 2026-06-22
updated: 2026-06-22
tags: [setup, tooling, nextjs, openrouter]
---

# Love AI Project Setup

## When to Use
- First time setting up the dev environment
- After cloning the repo on a new machine
- When a new agent session starts with no context

## Steps

1. Read `AGENT_MEMORY.md` and `PROJECT_CONTEXT.md` first.
2. Read `opportunity assessment.md` for the full spec.
3. Scan `from-thinking-to-coding/skills/` for relevant UI/UX skills before any frontend work.
4. Install dependencies: `npm install`
5. Copy `.env.example` to `.env.local`; set `OPENROUTER_API_KEY` to Love AI's key.
6. Run dev server: `npm run dev`
7. Verify `/api/health` returns 200.

## Environment Variables
- `OPENROUTER_API_KEY` — Love AI's server-side key (never expose to client)

## Key Paths
- Query bar component: `src/components/QueryBar/`
- API routes: `src/app/api/`
- State: `src/store/`

## Pitfalls
- Do NOT use `&&` in PowerShell — use `;` to chain commands
- Love AI's OpenRouter key is server-side only; BYOK goes through the client directly
- `create-next-app` refuses to run in a non-empty directory — scaffold into a subdirectory (e.g. `scaffold-temp`), then manually move files to root. Moving `node_modules` requires Smart Mode approval in Cursor.
- Tailwind v4 uses `@import "tailwindcss"` + `@theme inline {}` — NOT `@tailwind base/components/utilities`
- Next.js is now version 16 (2026) — same App Router patterns apply

## Verification
- [ ] `npm run dev` starts without errors
- [ ] `/api/health` returns `{ status: "ok" }`
- [ ] Query bar renders centered on dark background
- [ ] Model picker loads OpenRouter model list
