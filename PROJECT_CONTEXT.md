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
- Font: Helvetica Neue Bold (fallback Helvetica / Arial / sans-serif).
- Background: white.
- Text color: `#0d0c12`.
- Button background: `#675c56`.

## Known Future State (do not expose publicly)
LUV13 will eventually offer its own API keys for coding agents/LLM plugins. For v1 it routes upstream through OpenRouter; OpenRouter must not appear on the site.

## Architecture Snapshot
- Next.js 16 (App Router), React, TypeScript, Tailwind CSS v4.
- Single page at `/`.
- One API route: `POST /api/notify` for email capture (Resend).
- `GET /api/health` for quick verification.

## Deployment
- Dockerized Debian mini PC (founder's hardware).
- No Vercel-specific runtime APIs.

## Parking Lot
- User auth, dashboard, billing, key management, model-selection API, docs, testimonials, blog, dark mode, OpenRouter branding.

## Contact
- (to be added when available)
