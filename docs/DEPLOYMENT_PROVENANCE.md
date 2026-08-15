# Deployment provenance

Generated 2026-08-14. Identifies imported baselines, the local candidate, and
what was actually shipped to the mini-PC. This is not a production-gate
approval and does not claim the customer journey passed.

## Imported baselines

- API: deployed source commit `aeac7aad6098cb4200eb05071ef39d50c40a93a0`,
  tree `a8fdd960e85eabb8b75b2a0ba10ad95df957891c`.
- Proxy: deployed source based on commit
  `c38e8bb61edc0a529664325706ba96c4f95c4182`, tree
  `045b5a8acf69a8e46917b7415961527c1c11e91a`, with imported dirty patch
  SHA-256 `e8024dba7d78a75efa5481ecff51ce2bf61e233290c88e35e2d3e912ec1cfafb`.
- Full import evidence, container identities, and sanitization boundaries are
  recorded in `docs/PRODUCTION_SOURCE_IMPORT.md`.

## Current local candidate identity

- Workspace Git HEAD: `3a50fd2f9df16e207438ca7c8a3498c58b40506e` (uncommitted
  API/web work sits on top of this HEAD).
- API source snapshot SHA-256:
  `a51a0782a5c4759a85efbcdf06a35c7baca4b917675bc69d3544fe26f41c326e`.
- Proxy source snapshot SHA-256:
  `60c4fe8af018845cf9028bf7599c15d2a05647db0edda13a9cab22491b2412fb`.
- Web source snapshot SHA-256:
  `6dc957b9bfa32775f72f512642b0f4654c80ec128afb3fae975ab07719aebc4e`.

Snapshot hashes are SHA-256 over sorted records of
`<git-blob-hash><two spaces><repository-relative-path>` for every existing
tracked or untracked, non-ignored file under the named directory. Runtime data,
ignored secrets/config, dependencies, builds, and databases are excluded.

## Production deploy 2026-08-14 (host `kor`)

Predeploy rollback (restorable SQLite integrity `ok`, 3 users / 7 keys / 8
requests):

- `/home/kor/luv13-api/rollback/20260814T061500Z-pre-wallet/`
- Prior PATH-0 rollback remains:
  `/home/kor/luv13-api/rollback/20260814T044626Z-api-aeac7aad6098`

Shipped:

- `luv13-api` image `d2489523fd39` (`luv13-api-luv13-api:latest`), rebuilt with
  integer µ$ wallet, reservation/settlement, Stripe routes, `--proxy-headers`.
  Live `config.json` was merged in place to per-model integer rates; root
  `upstream_api_key` / `admin_secret` / `upstream_root` were preserved.
- `luv13-web` image `cdf7d472b52b`, container on host port **3100** (port 3000
  is already targeted by the korgems NPM host).
- NPM host 34 originally added mistaken `api.luv.ai` (HTTP, same 4100 backend).
  Canonical API host is now `api.luv13.ai` → :4100; keep `api.luv13.com`.
- NPM host 54 originally added mistaken `luv.ai` → `192.168.0.150:3100`.
  Canonical web host is now `luv13.ai` → :3100.
- Proxy container was **not** rebuilt or restarted.

Post-migrate live schema includes `users.balance_umicro`,
`requests.charge_umicro`, `topups`, and `credit_reservations`. Existing identity
counts were unchanged (3 / 7 / 8).

## Explicit non-claims

- Admin credential rotation has not been verified and must not be marked done.
- Canonical public origins are `https://luv13.ai` and `https://api.luv13.ai` on
  the mini-PC only. `luv.ai` is not a live origin (AWS/Route53 was the wrong
  domain). Cookie sharing across `luv13.ai` ↔ `api.luv13.ai` needs Cloudflare
  DNS-only A records to `71.209.199.134` plus TLS.
- Stripe LIVE secret key and webhook signing secret were absent on the host;
  Checkout URLs are set but no live payment or webhook credit was performed.
- This document does not approve TLS, CORS-on-the-public-origins, Stripe live
  mode, or the end-to-end customer journey.
