# PROJECT_CONTEXT — LUV13

## What this project is
A single-page information site for LUV13, an LLM hosting service. First model: GLM-5.2. Core claim: low costs, low prices.

## Audience
1. Developers/provider-hunters (e.g., users comparing providers on OpenRouter-style marketplaces).
2. Investors.
3. Curious visitors.

## Brand Source of Truth
- Logo: `BRAND_ASSETS/LUV13.png`
- Typography: `BRAND_ASSETS/typography.png`
- Font: Helvetica Neue Bold (fallback Helvetica / Arial / sans-serif). `--font-sans`/`--font-serif`/`--font-helveticaneue-bold` in `@theme inline` STAY (LUV13 brand fonts); the Vercel theme ships its own `--font-sans` `General Sans` but LUV13 overrides it post-bridge.
- Colors: **OVERRIDDEN** by Serafim "Vercel" 21st.dev theme (oklch). Old literals → new theme-bridged references:
  - Background: `#ffffff` → `oklch(var(--background))` (light `1 0 0` white; dark `0.141 0.004 285.824` near-black)
  - Foreground: `#0d0c12` → `oklch(var(--foreground))` (light `0.141 0.004 285.824`; dark `0.968 0.001 286.375`)
  - Button: `#675c56` → `oklch(var(--primary))` (`0.485 0.291 264.121` — a vivid blue, same in light/dark)
  - Surface/muted/accent/ring/etc. now reference the shadcn token set.
- `web/components.json` now exists (hand-crafted; do NOT run `shadcn init`).

## Known Future State (do not expose publicly)
LUV13 will eventually offer its own API keys for coding agents/LLM plugins. For v1 it routes upstream through OpenRouter; OpenRouter must not appear on the site.

## Architecture Snapshot
- Next.js 16 (App Router), React, TypeScript, Tailwind CSS v4.
- Pages: `/` (marketing), `/keys` (API key management UI), `/top-up`, `/top-up/success`.
- API routes:
  - `GET /api/health` — health check
  - `POST /api/notify` — email capture (Resend)
  - `GET /api/balance` — stub balance (`balanceCents`, `currency`, `minBalanceCents`)
  - `GET` + `POST /api/keys` — list/create API keys (in-memory stub; full secret returned once on create)
  - `POST /api/top-up` — stub top-up (`amountCents`, `method`)
- Stub data: `web/lib/stub-store.ts` — module-scoped in-memory balance + keys (starts at $0.00; swap for DB later).
- Components: `words-pull-up`, `scroll-float`, `holographic-card`, `notify-form`, `ui/flow-button`, `ui/liquid-glass`, `ui/base-url-display`, `ui/copy-field`, `api/*` (shell, balance, keys, top-up).

## Deployment
- Dockerized Debian mini PC (founder's hardware).
- No Vercel-specific runtime APIs.

## Parking Lot
- User auth, real billing (Stripe/PayPal), persistent key storage, usage dashboards, key revocation, model-selection API, docs, testimonials, blog, dark mode, OpenRouter branding.

## Contact
- (to be added when available)
