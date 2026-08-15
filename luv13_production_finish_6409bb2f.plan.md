---
name: LUV13 Production Finish
overview: Reformat the existing three-document plan into an agent-executable 10-phase runbook without changing its product scope or constraints, except for the explicit production-domain override to `luv.ai`/`api.luv.ai`. The result preserves the verified deployment facts, µ$ wallet model, PATH-0 repair, Stripe-only crediting, dual model slugs, owner routing, stop conditions, and production customer-journey definition of done.
todos:
  - id: phase-0
    content: Hermes restores production access and inventories topology, cookies/CORS, data, health, and rollback.
    status: in_progress
  - id: phase-1
    content: Import and inspect deployed API/proxy source without secrets or customer data.
    status: pending
  - id: phase-2
    content: Execute the approved one-write PATH-0 repair and prove a real customer-key completion.
    status: pending
  - id: phase-3
    content: Verify luv.ai/api.luv.ai TLS, routing, cookies, CORS, HLS, and Stripe redirects.
    status: pending
  - id: phase-4
    content: Back up and migrate the API wallet to integer µ$, then configure permanent/canonical GLM slugs.
    status: pending
  - id: phase-5
    content: Implement atomic reservation, streaming enforcement, exact settlement, and signup throttling.
    status: pending
  - id: phase-6
    content: Build and verify LIVE Stripe Checkout plus signed idempotent webhook crediting.
    status: pending
  - id: phase-7
    content: Replace web stubs and complete the authenticated dashboard, top-up, keys, usage, and curl flow.
    status: pending
  - id: phase-8
    content: Build, test, deploy in dependency order, and preserve rollback artifacts.
    status: pending
  - id: phase-9
    content: Run the full production customer journey and enforce the go/no-go checklist.
    status: pending
isProject: false
---

# LUV13 Production Finish Plan

## Authority and fixed decisions
- Read sources in order: [`PLAN.md`](/Users/real/luv/PLAN.md) → [`PLAN_ADDENDUM.md`](/Users/real/luv/PLAN_ADDENDUM.md) → [`PLAN_VERIFIED_FACTS.md`](/Users/real/luv/PLAN_VERIFIED_FACTS.md). Later documents win; this plan only restructures their content.
- Latest user override wins for URLs: dashboard `https://luv.ai`, top-up `https://luv.ai/top-up`, API `https://api.luv.ai`, webhook `https://api.luv.ai/billing/webhook`.
- Lock wallet rounding to **floor** and `OUTPUT_BUDGET_TOKENS=8000` tonight.
- Product DoD: signup/login → live Stripe top-up → create key → copy curl → successful GLM 5.2 call, all over valid HTTPS.

## Human gates
Before autonomous implementation:
- Confirm Hermes has stable SSH and will drive server-only phases.
- Approve PATH-0’s single proxy-DB write.
- Externally verify valid TLS/routing for `luv.ai` and `api.luv.ai`; Cloudflare is already configured.
- Register the LIVE Stripe webhook at `https://api.luv.ai/billing/webhook`, store its signing secret, and confirm live—not test—keys.
- Create an API SQLite backup inside the container and prove it can be restored before migration.

## Phase 0 — Production access and inventory
**Owner:** Hermes. **Depends on:** SSH gate.
- Restore/confirm access without weakening controls.
- Inventory live web/API/proxy containers, reverse proxy, WAL databases, bind mounts, secrets locations, revisions, logs, health checks, and rollback points.
- Confirm cookie attributes and credentialed CORS for `https://luv.ai` ↔ `https://api.luv.ai`; report values without secrets.
- Stop before mutation if ownership, data paths, or rollback are unclear.

## Phase 1 — Import and inspect deployed source
**Owner:** Hermes; Cursor assists locally. **Depends on:** Phase 0.
- Import deployed API/proxy source into `api/` and `proxy/`, preserving [`web/`](/Users/real/luv/web/) and excluding DBs, `.env`, keys, logs, caches, and customer data.
- Identify auth, routing, key generation, model mapping, metering, `_stream_chat`, migrations, usage, cookies/CORS, and packaging paths.
- Do not make major backend changes until imported revisions reproduce deployed behavior.

## Phase 2 — Restore PATH-0 metered traffic
**Owner:** Hermes. **Depends on:** approval and Phase 1.
- Reproduce a customer-key request and capture each boundary.
- Mint one fresh `sk-luv…` internal key with the existing proxy key-generation script; never hand-edit rows.
- Put it in `/home/kor/luv13-api/config.json` as `upstream_api_key`.
- Run `docker restart luv13-api`; do not rebuild and do not restart the proxy because proxy keys are read per request.
- Pass only when a customer-key call through `https://api.luv.ai` returns a real 200 GLM completion with no proxy 401.
- This is the only proxy-DB write in scope; keep all billing/auth logic out of the proxy.

## Phase 3 — Verify luv.ai production origins
**Owner:** Hermes + human. **May run alongside Phase 2 after TLS gate.**
- Validate TLS, hostname routing, redirects, HLS/assets, and mixed-content behavior for `luv.ai` and `api.luv.ai` externally.
- Update cookie domain/flags and credentialed CORS only as required for these origins; preserve `Secure`, `HttpOnly`, and the existing session behavior.
- Point Stripe success/cancel configuration to existing routes under `https://luv.ai`; top-up and all insufficient-credit links use `https://luv.ai/top-up`.
- Back up reverse-proxy configuration before edits and restore it if health regresses.
- Legacy `luv13.com`, `app.luv13.com`, and `www` TLS/DNS work is not gating tonight.

## Phase 4 — Migrate wallet and model configuration
**Owner:** Cursor writes code; Hermes migrates/deploys. **Depends on:** restorable backup and Phase 2.
- Apply idempotent API-DB-only migrations, checking `PRAGMA table_info` before `ALTER`:
  - `users.balance_umicro INTEGER NOT NULL DEFAULT 0`
  - `requests.charge_umicro INTEGER`
  - a `topups` table whose monetary amount is integer cents and whose Stripe session ID is uniquely indexed without unsupported `ALTER TABLE ... UNIQUE`
- Keep `requests.cost_usd REAL` only as a display mirror; never use floats for balance, charge, reserve, or settlement.
- Use `RATE_UMICRO_PER_MILLION=330000` and floor formula `(total_tokens * 330000) // 1_000_000` for both reservation and settlement.
- Convert Stripe credit with `cents * 10_000`; format µ$ as dollars only in the UI.
- Preserve `luv-1 → glm-5.2`; add canonical `luv13-glm-5.2 → glm-5.2`. New docs/UI/curl use the canonical slug.
- Do not surface or support tonight’s legacy prefixed slugs (`-fast`, `-kimi-code`, `-qwen3`, `-gemma-4-31b`).
- Verify rerunnable migration, restored existing users/keys/sessions, 3,000 tokens → 990 µ$, 100 tokens → 33 µ$, and 10–100-token requests remain nonzero.

## Phase 5 — Atomic credit enforcement
**Owner:** Cursor; Hermes deploys. **Depends on:** Phase 4.
- Sell customer-facing GLM 5.2 only tonight at $0.33/M total input+output tokens; other models remain visible only as Coming soon.
- Atomically reserve `(estimated_input_tokens + 8000) × rate` in µ$ before upstream work.
- If full reservation fails but balance covers input plus a small output floor, reserve the affordable amount; return 402 only when it cannot cover that minimum.
- Pre-gate zero balance with 402 and no upstream call.
- In `_stream_chat`, count only `delta.content`, preserve `tool_calls` deltas verbatim, and use `chars/4` solely as the in-reservation stream guard.
- When reserved credit is exhausted and no more can be reserved, close upstream and end SSE cleanly with: `You're out of credits. Top up here: https://luv.ai/top-up`.
- Settle exactly once on normal, error, cancellation, and cut paths; charge observed usage, atomically release the remainder, and make settlement idempotent.
- Add per-IP signup throttling. Prove concurrent requests cannot double-spend, every terminal path charges sanely, and no reservation is stranded.
- Incremental mid-stream re-reservation remains tomorrow’s work.

## Phase 6 — Live Stripe payments
**Owner:** Cursor + Hermes + human. **Depends on:** Phase 4 and Stripe gates.
- Build clean; no Stripe integration exists today, and proxy Neuralwatt bookkeeping is unrelated.
- Add cookie-authenticated `POST /billing/checkout` for $5/$10/$15/$30 presets and validated custom amounts, minimum 500 cents and a server-side maximum established in preflight.
- Add signature-verified raw-body `POST /billing/webhook`; only `checkout.session.completed` may transition a pending top-up and credit `balance_umicro`.
- Persist durable Stripe IDs and make webhook handling replay-safe. Never credit from redirects or browser calls.
- Keep live secrets in the server secret store/`.env` only, mode 600 and gitignored; never print or commit them.
- Verify a live $5 payment credits exactly 5,000,000 µ$ once; replay, invalid signature, bounds failure, and unauthenticated calls credit nothing.

## Phase 7 — Wire the customer-facing web flow
**Owner:** Cursor. **Depends on:** Phases 3 and 6.
- Replace [`web/lib/stub-store.ts`](/Users/real/luv/web/lib/stub-store.ts) and stub routes under [`web/app/api/`](/Users/real/luv/web/app/api/) with credentialed production calls to `https://api.luv.ai`.
- Preserve the hero visual; route **START CREATING** to email/password signup. Google auth, password reset, and email verification are out of scope.
- Provide one authenticated dashboard with balance, recent usage, top-up, and API-key create/list/revoke. Keys may be created at $0; show full secrets once only.
- Use a top-up modal with custom dollars and $5/$10/$15/$30 pills, all sharing one checkout path.
- After key creation, provide copy controls for key, `https://api.luv.ai`, `luv13-glm-5.2`, and a tested curl.
- Keep GLM’s directory card expandable with $0.33/M, slug, tools, and no vision; mark all other models Coming soon.
- Use plain tourist-friendly labels and “connect to Cursor in 2 minutes”; keep advanced detail secondary. Empty state says “top up to activate your key.”
- Install missing web dependencies, then verify desktop/mobile/keyboard states, refresh-safe auth, account scoping, and no logged secrets.

## Phase 8 — Build and deploy
**Owner:** Hermes drives; Cursor verifies web. **Depends on:** Phases 4–7.
- Run web production build plus API migration, reservation/concurrency, settlement, webhook, and integration tests against non-production data.
- Record predeploy revisions, backups, and rollback references.
- Deploy DB-compatible API first, then Stripe config/webhook, then web. Touch proxy only for approved PATH-0.
- API code changes require `compose up -d --build`; `config.json` and `.env` changes require `docker restart luv13-api`; config-only edits do not rebuild.
- Check health and sanitized logs after each service change.

## Phase 9 — Production journey smoke and go/no-go
**Owner:** Hermes drives; Cursor verifies web. **Depends on:** Phase 8.
- Verify valid TLS, HLS/assets, cookies, CORS, health, signup/login/logout, and refresh persistence on `luv.ai`/`api.luv.ai`.
- At $0, create a key; verify GLM returns 402 with the top-up URL and makes no upstream call.
- Complete a live $5 checkout; verify one signed webhook credit, dashboard refresh, and no replay credit.
- Create/copy a key and run the generated curl with `luv13-glm-5.2`; verify completion, balance debit, and usage row. Confirm permanent `luv-1` alias still works.
- Verify stream exhaustion emits readable guidance and clean termination; other models remain unusable Coming soon.
- Go only if backups restore, accounting/concurrency tests pass, secrets are absent from source/logs, and the complete journey passes. No-go on overspend, stranded reservations, duplicate credit, auth leakage, broken TLS/CORS/HLS/curl, or unreconcilable payments.

## Permanent guardrails
- `luv13-proxy` remains a dumb pipe; never break `/internal/*` or Bearer auth on `/v1/chat/completions`.
- Credits move only through the signed Stripe webhook.
- Back up before migration; migrations are idempotent; secrets stay out of git/logs.
- Preserve SSE and `tool_calls` framing; do not worsen the known parallel-tool-call issue.
- Public copy never mentions OpenRouter or raw upstream aliases.
- Risky proxy changes remain plan-only until explicitly approved.

## Deferred and non-blocking
- Tomorrow: incremental re-reservation, all-model pricing/catalog work, precise tokenizer, expanded abuse controls, subscriptions, Google auth, password reset, email verification, broader dashboard/docs/analytics polish, model-directory IA, and hero collaboration.
- Known follow-ups: parallel-tool-call freeze, degraded proxy-header brute-force throttle, in-memory login throttle reset, SQLite scale stalls, unconfirmed Gemma routing, and exposed admin-credential rotation.
- The unavailable Hermes report can later pin `_stream_chat` relay line numbers; it does not block execution.