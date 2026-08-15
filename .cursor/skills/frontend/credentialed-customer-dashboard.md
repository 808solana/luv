---
name: credentialed-customer-dashboard
description: Use when wiring the LUV13 web account UI to the FastAPI customer contract. Keeps cookie auth, wallet math, and one-time API secrets safe.
created: 2026-08-13
updated: 2026-08-14
tags: [frontend, auth, dashboard, billing, api-keys]
---

# Credentialed Customer Dashboard

## When to Use
- Building or changing LUV13 signup, login, dashboard, billing, usage, or API-key UI.
- Adding a browser read contract that must be scoped to the authenticated account.
- Don't use when changing proxy transport or production deployment.

## Steps
1. Route every browser account request through `web/lib/api.ts`; keep the API base configurable and send `credentials: "include"`.
2. Treat a 401 from `/auth/me` as an expired/revoked session and route to login; never infer auth from client storage.
3. Return customer data from cookie-authenticated API endpoints that derive `user_id` from the session, never request parameters.
4. Keep wallet values as integer µ$ through the API boundary and format dollars only for display.
5. Send every top-up amount through `POST /billing/checkout`; redirect only to the returned Stripe URL and never credit from browser state.
6. Keep a newly created full key in transient component state only. Clear it when the one-time dialog closes and never log or persist it.
7. Use only the canonical public API URL and model slug in customer copy and generated curl examples.
8. Verify loading, empty, error, keyboard, mobile, and reduced-motion states.

## Pitfalls
- A same-site fetch without `credentials: "include"` silently loses cross-subdomain sessions.
- Gating key creation on balance is incorrect; keys may be created at $0.
- Returning `upstream_model` in recent usage leaks an internal alias; return the customer-requested model field.
- Querying usage by client-provided email or user ID breaks account scoping.
- Keeping a secret in local storage, URL state, analytics, or logs defeats one-time key handling.

## Verification
- [ ] Refreshing `/dashboard` restores the cookie session through `/auth/me`.
- [ ] A revoked/expired session routes to `/login`.
- [ ] Recent usage cannot include another user's rows.
- [ ] Key create/list/revoke works at a $0 balance.
- [ ] The full key disappears permanently when its dialog closes.
- [ ] Preset and custom top-ups share one checkout request path.
- [ ] Frontend lint/typecheck/tests/build and API tests pass.

## Usage
- 2026-08-13: Created from the Phase 7 production dashboard integration.
- 2026-08-14: Hero base URL copy must be `https://api.luv13.ai/v1`; do not leak `api.luv13.com` or `api.luv.ai` in `base-url-display.tsx`.
- 2026-08-14: Origin cutover — public copy/API base is `https://api.luv13.ai`; `luv.ai` is not a live origin.
