# LUV13 — Tonight's Source-of-Truth Plan

## Product intent and definition of done

LUV13 must become a product a customer can actually use tonight: **“everything is working”; “a customer can use this”; “it doesn't have to be perfect. It just has to be good.”**

Tonight is done only when a new customer can complete this journey in production:

**Homepage → email/password signup or login → live Stripe top-up → create an API key → copy a working curl example → receive a successful GLM 5.2 response.**

This file supersedes `docs/PLAN.md`, `docs/SPEC.md`, and stale implementation claims in other internal docs for tonight's work. `AGENT_MEMORY.md` remains authoritative for product intent, but its paths and live-system claims must be verified before use.

## Facts, assumptions, and open blockers

### Verified current state

- **Repo:** Next.js-only. It contains the polished marketing/model directory, HLS background, Resend capture, health endpoint, Docker support, and in-memory balance/key/top-up stubs.
- **Missing in the web product:** frontend auth, persistent wallet, usage dashboard, live Stripe, and a real API connection.
- **Production API:** `api.luv13.com` is live and exposes auth, keys, usage, models, and chat. It has no billing routes.
- **Source control gap:** production FastAPI and proxy source are not in this repository.
- **Reachability:** API health and HLS are reachable.
- **Domain:** apex `luv13.com` currently fails TLS SNI; `www.luv13.com` has no DNS record.
- **Local build:** `web/node_modules` is absent, so the current build fails because `next` is unavailable.
- **Legacy documentation:** `docs/PLAN.md`, `docs/SPEC.md`, and parts of `PROJECT_CONTEXT.md` describe an earlier marketing-only product and are stale for tonight.

### High-confidence but unverified

- **PATH-0:** `AGENT_MEMORY.md` says the FastAPI service uses an internal proxy key that no longer exists in the proxy database, causing the metered path to fail with proxy 401s.
- Treat PATH-0 as the first application-path hypothesis, not as a proven fact. Prove it from live configuration, logs, and a controlled API call after SSH access is restored.

### Preflight checks

- Restore SSH access to the Debian server; the latest attempt timed out.
- Identify the actual live source paths, services/containers, compose files, data volumes, reverse proxy, restart behavior, and rollback mechanism. Do not rely on stale paths from memory.
- Determine how proxy keys are created and loaded, including whether key state is cached and whether a restart is required.
- Locate the production database, confirm its engine/schema/WAL behavior, and prove a restorable backup procedure before migration.
- Confirm Stripe is in live mode and identify the approved secret store, webhook endpoint, success/cancel URLs, and a safe server-side maximum custom top-up. Minimum is fixed at **$5**.
- Confirm production cookie domain, allowed origins, credentialed CORS behavior, and the intended `www` policy: serve it or redirect it.
- Confirm the deployed revisions before changes and record exact rollback artifacts. Never infer them from local docs.

## Product decisions — do not re-litigate tonight

- **Only real model tonight:** GLM 5.2 at **$0.33 per million total tokens**.
- **Customer slug:** `luv13-glm-5.2`.
- Every model will eventually have its own flat total-token rate. Pricing tests and all other model pricing happen tomorrow.
- Other LUV13 model cards may remain visible, but must say **Coming soon** and must not be purchasable or usable tonight.
- Existing prefixed slugs may remain available internally while compatibility is assessed: `luv13-glm-5.2-fast`, `luv13-kimi-code`, `luv13-qwen3`, `luv13-gemma-4-31b`.
- Website, dashboard, examples, and customer docs expose only `luv13-*` slugs. Raw upstream aliases stay undocumented.
- Do not visually redesign the homepage hero. Its empty/unfinished “eye candy” is intentional. Wire the existing **START CREATING** CTA to signup.
- The model directory is a rough draft. Selecting a model expands an inline detail area directly below its card/row; no model detail page.
- GLM's expanded detail includes price, slug, tools/capabilities, and copy controls. GLM has tools and no vision. Broader catalog work waits.
- Email/password auth only. Google, password reset, and email verification wait.
- A customer may create an API key with a $0 balance. Calls at zero return **402** with direct top-up guidance.
- Minimal dashboard: balance, top-up, API keys, and recent usage.
- Recent usage columns: timestamp, model, input tokens, output tokens, cost, status.
- Stripe Checkout is live, one-time payment only: presets **$5 / $10 / $15 / $30** plus a validated custom amount.
- After key creation, show the base URL, `luv13-glm-5.2`, and a working curl example. Reveal the full secret once if the backend supports that behavior.
- Target repository layout after source recovery: `web/`, `api/`, `proxy/`.
- No subscriptions, fake payment methods, hero redesign, expanded abuse controls, password reset, email verification, precise tokenizer, or other-model pricing tonight.

## Execution plan

Work phases are ordered by dependency. Do not start downstream feature work against guessed production code or an unverified customer path.

### Phase 0 — Restore and inventory production access

**Owner:** infra

**Tasks**
- Restore SSH connectivity without weakening network or host security.
- Identify the live web, API, proxy, database, reverse proxy, DNS/TLS, secret, and deployment topology.
- Record deployed revisions/images and the existing rollback path.
- Locate authoritative logs and health checks without printing secrets.

**Acceptance**
- An operator can access the host reliably.
- Live service ownership, paths, data locations, and deployment/restart behavior are verified from the server.
- Current health and deployed versions are captured without mutation.

**Stop / rollback**
- Stop if access requires disabling security controls, exposing SSH publicly without approved restrictions, or using unverified credentials.
- This phase should not mutate application state; revert any temporary access rule immediately after establishing an approved durable path.

### Phase 1 — Import and inspect backend/proxy source safely

**Owner:** infra + api + proxy

**Tasks**
- Copy the exact deployed API and proxy source into local `api/` and `proxy/`.
- Exclude databases, environment files, private keys, generated data, logs, caches, and other secrets.
- Preserve the existing `web/` application; reconcile configuration templates without copying live values.
- Inspect actual auth, model routing, usage metering, stream relay, key creation, migrations, health checks, and deploy packaging.
- Reconcile live behavior against `AGENT_MEMORY.md`; update the implementation plan if verified code differs.

**Acceptance**
- `web/`, `api/`, and `proxy/` contain the source needed to reproduce the deployed system.
- Secret scanning/manual review finds no credentials or customer data in imported files.
- The team can identify the exact code paths for chat routing, stream handling, usage writes, auth cookies, and API-key creation.

**Stop / rollback**
- Do not import live databases or `.env` files.
- Do not make major backend changes until imported source is inspected and the live revision is reproducible.
- Source import is non-production work; if provenance is unclear, quarantine the copy and repeat from the verified deployment artifact.

### Phase 2 — Prove or fix PATH-0

**Owner:** api + proxy + infra

**Tasks**
- Reproduce one controlled customer-key call through FastAPI and capture the status boundary-by-boundary.
- Compare the configured API-to-proxy credential with the proxy's accepted key state without exposing either value.
- If the stale-key hypothesis is proven, use the proxy's existing key-management path to create/rotate an internal key, update the approved secret/config location, and perform only the restart confirmed necessary by inspection.
- Keep customer auth and billing logic in FastAPI; the proxy remains a transport/key-rotation layer.

**Acceptance**
- A customer-key call through `api.luv13.com` reaches GLM and returns a real completion.
- Logs show no proxy 401 and no secret material.
- API and proxy health remain green after any restart.

**Stop / rollback**
- Stop if the proxy key lifecycle, cache behavior, or database mutation path is unclear.
- Never hand-edit proxy database rows.
- Roll back to the captured prior config/key reference if the new credential causes regressions; keep the previous credential recoverable in the secret store until validation passes.

### Phase 3 — Repair TLS and DNS

**Owner:** infra

**Tasks**
- Diagnose the apex SNI failure at the actual TLS terminator.
- Install/renew and bind the correct certificate and virtual host for `luv13.com`.
- Add the intended `www` DNS record and either serve or redirect it consistently.
- Confirm `api.luv13.com` remains valid and HLS delivery is unaffected.
- Verify HTTPS redirects, cookie scope, credentialed CORS, and browser requests across the final origins.

**Acceptance**
- External clients validate the certificate and hostname for apex, `www`, and API.
- Homepage, signup/login cookies, API calls, redirects, and HLS work without mixed-content, CORS, or SNI errors.

**Stop / rollback**
- Back up TLS/reverse-proxy configuration before edits.
- Stop if certificate issuance would overwrite working API/HLS routing.
- Restore the prior config if health checks or routing regress; do not continue feature rollout over broken TLS.

### Phase 4 — Back up and migrate wallet/usage data

**Owner:** api + infra

**Tasks**
- Create and verify a consistent production database backup using the database's actual supported mechanism.
- Add an idempotent migration for integer-cent wallet state, top-ups, and request reservations/settlements. Do not use floating-point columns for money movement.
- Preserve existing users, keys, sessions, and usage.
- Ensure recent usage stores or exposes timestamp, customer model slug, input tokens, output tokens, integer-cent cost, and status.
- Define a deterministic integer rounding policy for charges and reservations; cover boundary cases at the $0.33/M rate. Do not silently mix dollars, cents, and floats.

**Acceptance**
- Backup restoration is proven before migration.
- Migration succeeds on a production-shaped copy and can be safely re-run.
- Existing rows remain readable; $0 starts at exactly zero cents.
- Balance/top-up/reservation invariants pass tests, including duplicate and interrupted operations.

**Stop / rollback**
- Stop if no restorable backup exists, migration rewrites or drops existing data, or money units are ambiguous.
- Restore the backup and prior application revision if migration or compatibility checks fail.

### Phase 5 — Implement pricing and atomic credit enforcement

**Owner:** api

**Tasks**
- Allow only `luv13-glm-5.2` for customer traffic and map it to the verified upstream model.
- Price both input and output at one flat rate: **33 cents per 1,000,000 total tokens**.
- Before calling upstream, estimate input usage and reserve enough credit atomically for input plus the allowed output budget. If an explicit output limit is absent, apply a verified server-side default/cap.
- Acquire the reservation with one database transaction/conditional update so concurrent requests cannot reserve the same cents.
- Return 402 before upstream work when no valid reservation can be made; include clear top-up guidance and the real top-up URL.
- During streaming, track output with the MVP character estimate only as a guard inside the already-reserved budget. `chars / 4` is not sufficient concurrency control and must not be the only enforcement.
- On normal completion, settle against reported input + output usage and atomically release unused reserved credit.
- On upstream error, disconnect, cancellation, timeout, or forced exhaustion, charge only the defined observed/estimated usage and release the remainder in the same settlement transaction.
- If reserved credit is exhausted, close upstream, emit a clear insufficient-credit error in a client-compatible final event, preserve tool-call framing, and end the stream cleanly.
- Make settlement idempotent so retries cannot double-debit or double-release.

**Acceptance**
- Zero balance returns 402 and never calls upstream.
- A $0 customer can still create an API key.
- Sequential and concurrent tests cannot spend or reserve below zero.
- Input-heavy, output-heavy, non-streaming, streaming, cancellation, upstream-error, missing-usage, and retry cases settle correctly.
- A forced stream cutoff is readable, contains top-up guidance, terminates cleanly, and leaves no stranded reservation.
- Usage reports `luv13-glm-5.2`, both token counts, cost, and final status.

**Stop / rollback**
- Do not deploy if concurrency tests can overspend, if errors leak reservations, or if stream changes break content/tool-call framing.
- Roll back application code without reversing a successful schema migration unless restoration has been rehearsed; disable customer model traffic if safe enforcement cannot be guaranteed.

### Phase 6 — Add live Stripe Checkout and webhook crediting

**Owner:** api + web + infra

**Tasks**
- Add authenticated one-time Checkout creation for presets and custom amounts.
- Enforce server-side bounds in integer cents: minimum **500 cents**; confirm and configure the maximum during preflight. Never trust a client-supplied amount, user ID, price, or completion state.
- Create pending top-up records with durable Stripe identifiers.
- Verify webhook signatures against the raw request body.
- Treat the signed webhook as the **only** authority that credits balance.
- In one atomic, idempotent transaction, mark a completed payment and add its integer cents exactly once. Handle webhook retries and out-of-order delivery.
- Store secrets only in the approved server secret mechanism; log identifiers/statuses, never secrets or full payment payloads.
- Make success/cancel pages informational; poll/refetch balance after return rather than crediting from the redirect.

**Acceptance**
- A real live-mode $5 Checkout completes and its signed webhook credits exactly 500 cents once.
- Replaying the same webhook does not add credit again.
- Invalid signatures, amounts below/above bounds, unauthenticated creation, abandoned Checkout, and forged success redirects add no credit.
- Presets and custom amount use the same validated backend path.

**Stop / rollback**
- Stop if live/test Stripe modes are mixed, webhook signatures are not verified, or idempotency is not proven.
- Disable Checkout creation before rollback; preserve payment/top-up records and reconcile any completed Stripe payments before restoring application code.

### Phase 7 — Wire the customer-facing web flow

**Owner:** web + api

**Tasks**
- Replace in-memory balance, key, and top-up stubs with the verified production API integration.
- Add email/password signup, login, logout, authenticated routing, loading/empty/error states, and safe session handling.
- Wire **START CREATING** to signup without changing the hero's visual composition.
- Build the minimal dashboard:
  - current balance and refresh-after-payment behavior;
  - top-up presets plus validated custom amount;
  - API-key creation/listing/revocation supported by the API;
  - recent usage columns: timestamp, model, input tokens, output tokens, cost, status.
- Allow key creation at $0. Reveal the full key once when returned; never persist it in client logs or analytics.
- After key creation, show copy controls for the key, production base URL, `luv13-glm-5.2`, and a tested curl example.
- Add inline model expansion directly under the selected card/row. For GLM show $0.33/M total tokens, slug, tools, no vision, and copy controls.
- Mark every other model **Coming soon** and prevent selection/purchase/use.
- Keep raw upstream aliases out of all customer copy, metadata, examples, and docs.

**Acceptance**
- Signup/login survives refresh and logout revokes/clears the session as designed.
- Dashboard data belongs only to the signed-in customer.
- The CTA, top-up, key creation, copy controls, model expansion, and recent usage all work on desktop and mobile with keyboard access.
- No hero visual change is present.
- Copied curl works unchanged except for inserting the newly revealed key.

**Stop / rollback**
- Stop if cookies fail over HTTPS, CORS permits an unsafe origin, customer data crosses accounts, or secrets appear in browser/server logs.
- Roll back web independently to the last healthy image while keeping API billing disabled from public UI if the journey is incomplete.

### Phase 8 — Install, build, deploy, and verify

**Owner:** web + api + proxy + infra

**Tasks**
- Identify the repository's actual package manager/lockfile, install local web dependencies, and run the existing checks.
- Run API/proxy tests and production-shaped integration tests against non-production data.
- Build reproducible deployment artifacts for changed services.
- Record pre-deploy versions, backup references, migration status, environment changes, and rollback artifacts.
- Deploy in dependency order: database-compatible API, Stripe webhook/config, then web. Change proxy only if PATH-0 requires it.
- Run health checks after each service change and inspect sanitized logs.

**Acceptance**
- Web production build completes with dependencies installed.
- API tests, migration tests, concurrency/settlement tests, Stripe webhook tests, and integration tests pass.
- Production web, API, proxy, HLS, TLS, auth, and billing health are green after deployment.
- Rollback steps and artifact references are available to the operator.

**Stop / rollback**
- Do not deploy with a failing build/test, missing secret, unverified backup, unresolved TLS/CORS/cookie issue, or untested rollback.
- On regression, stop traffic to the affected new path, restore the prior artifact/config, and verify health before further work.

### Phase 9 — Full production customer-journey smoke test

**Owner:** web + api + proxy + infra

Use a fresh production customer and a real live payment. Do not use admin bypasses.

**Acceptance checklist**
- [ ] Open `https://luv13.com` with valid TLS; HLS and page assets load.
- [ ] Click **START CREATING** and reach email/password signup.
- [ ] Sign up, log out, log back in, and remain correctly scoped.
- [ ] See a $0 balance and create an API key at $0.
- [ ] Confirm a GLM call at $0 returns 402 with clear top-up guidance and performs no upstream inference.
- [ ] Start a live $5 Stripe Checkout and complete payment.
- [ ] Confirm the signed webhook credits exactly $5 once and the dashboard updates.
- [ ] Create a fresh key and copy the one-time secret, base URL, model slug, and curl example.
- [ ] Run the copied curl against `luv13-glm-5.2` and receive a successful response.
- [ ] Confirm balance decreases and recent usage shows timestamp, model, input tokens, output tokens, cost, and success status.
- [ ] Select GLM in the directory and see the inline details: $0.33/M total, slug, tools, no vision, copy controls.
- [ ] Confirm all other visible models say **Coming soon** and cannot be used.
- [ ] Replay/refresh Stripe return and confirm there is no duplicate credit.
- [ ] Exercise an insufficient-credit stream and confirm a clear error plus clean termination.
- [ ] Confirm apex, `www`, API, cookies, CORS, HLS, and health checks remain valid externally.

## Operational go / no-go

### Go only if

- [ ] SSH access is stable and the live topology is verified.
- [ ] API/proxy source is safely present in the monorepo with no secrets or customer data.
- [ ] PATH-0 is proven resolved by a real API completion.
- [ ] TLS/DNS, cookies, and CORS work on production origins.
- [ ] A restorable database backup exists.
- [ ] Migration and rollback behavior are rehearsed.
- [ ] Integer-cent accounting, atomic reservation, settlement/release, and concurrency tests pass.
- [ ] Stripe live mode, signature verification, idempotency, and a real $5 payment pass.
- [ ] Secrets are neither committed nor logged.
- [ ] Build, deploy, health, and complete customer-journey smoke tests pass.

### No-go if

- [ ] Customer calls can overspend, go below zero, or strand reservations.
- [ ] Redirects/client input can credit a wallet, or webhook retries can double-credit.
- [ ] Any auth/customer data can cross accounts.
- [ ] TLS, cookie, CORS, API health, HLS, or copied curl is broken.
- [ ] The production DB cannot be restored or payment records cannot be reconciled.
- [ ] Raw upstream aliases or secrets appear in customer-facing output or logs.

## Technical cautions

- Money movement uses integer cents and atomic database transactions. Never use binary floating-point balance math.
- The $0.33/M rate applies to **input + output**. Define and test integer rounding explicitly.
- Reservation must happen atomically before upstream work; output `chars / 4` alone does not close concurrent overspend.
- Every terminal path settles observed usage and releases unused reservation exactly once.
- The Stripe webhook is the only credit authority. Redirects are UX only.
- Back up and prove database restore before migration.
- Never log session cookies, full API keys, internal proxy keys, Stripe secrets/signatures, passwords, or live `.env` values.
- Preserve SSE and tool-call framing when adding stream accounting. Insufficient credit must end with a clear message/error and a clean terminal event.
- Verify HTTPS, cookie domain/flags, credentialed CORS, and allowed origins together.
- Expose customer `luv13-*` slugs only; keep upstream aliases undocumented.

## Tomorrow / not tonight

- Pricing tests and pricing decisions for every model beyond GLM 5.2.
- Enable and validate the remaining LUV13 model catalog.
- Refine model-directory information architecture, content, and interaction beyond the GLM inline detail.
- Collaborate on the hero's intentionally unfinished visual/content direction.
- Google sign-in, password reset, and email verification.
- Precise tokenizer-based live estimation.
- Expanded abuse controls, signup hardening, and broader rate limiting.
- Subscriptions or additional payment methods.
- Broader docs, onboarding polish, analytics, and nonessential dashboard features.
- Resolve compatibility/deprecation strategy for prefixed and raw upstream aliases.
