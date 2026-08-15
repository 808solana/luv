# PROJECT_CONTEXT — LUV13

## What this project is
LUV13 is an LLM hosting service with a marketing site, email/password customer accounts, a metered API, Stripe-funded wallets, and an authenticated dashboard. The live customer model is GLM-5.2 at $0.33 per million total tokens.

## Audience
1. Developers and coding-agent users comparing API providers.
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

## Customer Product
- Customers sign up with email/password and use a cookie session shared by `luv13.ai` and `api.luv13.ai`.
- API keys can be created at a $0 balance; model requests require sufficient wallet credit.
- Public examples use only `https://api.luv13.ai` and `luv13-glm-5.2`.

## Architecture Snapshot
- Next.js 16 (App Router), React, TypeScript, Tailwind CSS v4.
- Pages: `/` (marketing), `/signup`, `/login`, `/dashboard`; `/keys` and `/top-up` preserve compatibility by redirecting into the dashboard.
- API routes:
  - `GET /api/health` — health check
  - `POST /api/notify` — email capture (Resend)
- Browser account calls use `web/lib/api.ts`, default to `https://api.luv13.ai`, and always send `credentials: "include"`.
- The dashboard shows the integer µ$ wallet balance, account-scoped recent usage, Stripe Checkout top-up modal, and account-scoped key create/list/revoke.
- Full API-key secrets are held only in transient component state and shown once after creation.
- `GET /api/usage` is the cookie-authenticated, user-scoped recent-usage read contract.

## Deployment
- Dockerized Debian mini PC (founder's hardware), SSH alias `kor`.
- No Vercel-specific runtime APIs.
- API wallet migration is live on `luv13-api` (`users.balance_umicro`, reservation/settlement, Stripe routes). Canonical public HTTPS API is `https://api.luv13.ai`. Legacy `https://api.luv13.com` still works.
- Customer web runs as `luv13-web` on host port 3100; NPM serves `luv13.ai` → :3100 and `api.luv13.ai` → :4100. Hosting is the mini-PC only; do not invent AWS. `luv.ai` is not a live origin.
- `luv13.ai` NS are Cloudflare. Public A records currently orange-cloud to Cloudflare IPs, not DNS-only to `71.209.199.134`. Grey-cloud those A records if issuing NPM HTTP-01 certs.
- Stripe LIVE keys/webhook secret are a human gate. Proxy remains the untouched dumb pipe.

## Imported Production Backends
- `api/` is the sanitized source imported from deployed `luv13-api` commit `aeac7aad6098cb4200eb05071ef39d50c40a93a0`; it contains the FastAPI auth, customer-key, metering, usage, migration, passthrough, and SSE relay paths.
- The local API Phase 4 foundation uses integer micro-dollars for wallet balances and request charges, integer cents for Stripe top-ups, and integer per-model sell rates. `requests.cost_usd` remains display-only.
- The local API Phase 5 enforcement atomically reserves credit before upstream work, caps output to the reserved allowance, and transactionally settles/refunds exactly once across completion, error, cancellation, and stream-cut paths. Signup attempts are throttled per client IP.
- The local API Phase 6 billing uses Stripe Checkout with cookie-authenticated session creation, persisted integer-cent pending top-ups, raw signature verification, strict persisted-record consistency checks, and transactionally idempotent webhook credits.
- Pre-deployment hardening validates all throwable chat fields before reservation, funnels every later path through one settlement guard, bills missing usage with a separate chars/4 fallback, conservatively retains bounded reserve for unmetered tool calls, and reconciles Stripe session-attachment failures through deterministic idempotency and signed metadata.
- Customer API routing accepts canonical `luv13-glm-5.2` and compatibility alias `luv-1`, both targeting `glm-5.2`; legacy suffixed proxy slugs are not part of the customer API configuration.
- `proxy/` is the sanitized source imported from the running dirty `neuralwatt-proxy` tree based on commit `c38e8bb61edc0a529664325706ba96c4f95c4182`; host and container `proxy.py` matched at import.
- Live env/config, upstream keys, SQLite/WAL data, logs, captures, caches, rollback artifacts, and customer/runtime data are intentionally absent. See `docs/PRODUCTION_SOURCE_IMPORT.md` for provenance and the sanitization boundary.
- The production architecture is browser/client → FastAPI API (`:4100`) → Flask/Gunicorn proxy (`:4000`) → Neuralwatt. Business auth/billing belongs in the API; the proxy remains transport/account rotation.

## Parking Lot
- Password reset, email verification, broader model catalog/pricing, docs, testimonials, blog, and dashboard analytics polish.

## Contact
- (to be added when available)
