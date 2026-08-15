---
name: sqlite-integer-wallet-migration
description: Use when evolving LUV13 wallet or payment schema. Keeps money integer-only and SQLite migrations rerunnable.
created: 2026-08-13
updated: 2026-08-13
tags: [sqlite, migration, money, wallet, stripe]
---

# SQLite Integer Wallet Migration

## When to Use
- Adding or changing wallet, usage-charge, or top-up persistence.
- Changing per-model sell rates or Stripe amount conversion.
- Don't use for display-only currency formatting.

## Steps
1. Keep wallet values in integer micro-dollars and Stripe values in integer cents.
2. Inspect `PRAGMA table_info` before each `ALTER TABLE ... ADD COLUMN`.
3. Add uniqueness with a separate `CREATE UNIQUE INDEX IF NOT EXISTS`; SQLite cannot add a unique column.
4. Preserve historical `requests.cost_usd` only as a display mirror and store exact charges in `charge_umicro`.
5. Calculate charges with `(tokens * rate_umicro_per_million) // 1_000_000`.
6. Convert Stripe cents with `cents * 10_000`.
7. Test the migration twice against a populated legacy schema and assert users, keys, sessions, and usage remain.
8. Reserve with `BEGIN IMMEDIATE`, a conditional balance decrement, and a durable active reservation row before upstream work.
9. Settle idempotently in one transaction: mark the reservation settled, refund unused credit, and insert the usage row.
10. On single-worker startup, settle/refund any active reservations left by a prior process crash before accepting traffic.
11. Create a pending top-up before calling Stripe and bind the Checkout Session to its persisted top-up/user IDs in both metadata and `client_reference_id`.
12. Verify the raw webhook signature before reading event fields; transactionally compare persisted amount and Stripe identifiers before a single pending-to-completed credit.
13. Validate every throwable request shape before reserving, then transfer one settlement guard from handler setup to the stream relay.
14. Keep conservative reservation estimation separate from chars/4 fallback billing; retain the bounded output reserve when tool-call output occurred without trustworthy usage.
15. Give each persisted top-up a deterministic Stripe idempotency key and allow verified webhook metadata to recover a missing local session attachment.

## Pitfalls
- Float rates can silently round tiny requests or diverge from settlement.
- Rebuilding tables for simple additive changes risks dropping customer data.
- Putting `UNIQUE` on a later `ALTER TABLE ADD COLUMN` is unsupported by SQLite.
- Converting display dollars back into wallet units reintroduces float accounting.
- Python's SQLite connection context commits or rolls back but does not close the connection; wrap connection creation so every path closes it.
- Catch cancellation and unexpected upstream exceptions after reservation, not only HTTP client exceptions, or credit can remain stranded.
- Checkout redirects and client-provided metadata are not payment proof; only a verified, matching paid completion event may credit.
- A `finally` around only the upstream call is too narrow: key touches, cap mutation, stream options, request construction, and relay handoff can all fail after reservation.
- UTF-8 byte counts are safe reservation upper bounds but unfair fallback billing estimates.
- Running `PRAGMA journal_mode=WAL` on every connection adds avoidable lock work; configure it during initialization/migration.

## Verification
- [ ] Migration succeeds twice without schema duplication.
- [ ] Existing identity, key, session, and usage rows are unchanged.
- [ ] 3,000 tokens charges 990 µ$; 100 charges 33 µ$; 10 charges 3 µ$ at the GLM rate.
- [ ] 500 cents converts to 5,000,000 µ$.
- [ ] Stripe session uniqueness is enforced by an index.
- [ ] Wallet calculation functions contain integer-only arithmetic.
- [ ] Concurrent reservations cannot spend the same balance.
- [ ] Normal, error, cancellation, and forced-cut paths settle exactly once.
- [ ] Invalid signatures, mismatched amounts/identities, unrelated event types, and concurrent webhook replays credit nothing.
- [ ] Malformed request fields and unsupported `n` fail before reservation.
- [ ] Every failure between reserve and relay completion creates one settled usage row.

## Usage
- 2026-08-13: Added the Phase 4 API wallet and model-rate foundation.
- 2026-08-13: Added Phase 5 atomic reservation, settlement, and stream exhaustion enforcement.
- 2026-08-13: Added Phase 6 Stripe Checkout and idempotent signed-webhook crediting.
- 2026-08-13: Hardened pre-deployment settlement ownership, fallback billing, config migration, and Stripe reconciliation.
- 2026-08-14: Applied the idempotent wallet migration on live `luv13-api` after a restorable VACUUM INTO backup; existing user/key/request counts unchanged.
