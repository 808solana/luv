---
name: luv13-production-deploy
description: Use when deploying LUV13 API/web to the kor mini-PC. Backs up SQLite/NPM, merges live config, and does not invent Stripe or DNS.
created: 2026-08-14
updated: 2026-08-14
tags: [deploy, docker, nginx-proxy-manager, sqlite, stripe]
---

# LUV13 Production Deploy

## When to Use
- Shipping `api/` or `web/` to SSH host `kor`.
- Merging live `config.json` into the per-model integer-rate shape.
- Adding NPM vhosts for `luv13.ai` / `api.luv13.ai` without breaking `api.luv13.com`.
- Don't use for proxy-DB writes (PATH-0 only, already done) or inventing secrets.

## Steps
1. Record predeploy revisions. Copy `config.json`, `.env`, `app/`, Dockerfile, and NPM `database.sqlite` + the affected `proxy_host/*.conf` into `/home/kor/luv13-api/rollback/<stamp>/`.
2. Inside `luv13-api`, `PRAGMA wal_checkpoint(FULL)` then `VACUUM INTO` a backup DB. `PRAGMA integrity_check` must be `ok` and row counts must match live before continuing.
3. Merge live `config.json` in place: convert string model routes to `{upstream, rate_umicro_per_million}` objects, add `luv13-glm-5.2` from `luv-1`→`glm-5.2`, keep `upstream_api_key` / `admin_secret` / `upstream_root` byte-identical. Never copy local example secrets onto the host.
4. Update only routing env keys (`COOKIE_DOMAIN`, `FRONTEND_URL`, `FORWARDED_ALLOW_IPS`, Stripe success/cancel URLs). Leave `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` absent if empty.
5. Stream a tar of `api/app`, Dockerfile, `requirements.txt` over SSH. Exclude `.env`, `config.json`, `data/`, `.git`. `docker compose up -d --build` from `/home/kor/luv13-api`.
6. Deploy web to `/home/kor/luv13-web` on host port **3100**, not 3000. NPM already forwards `korgems.com` to 3000.
7. NPM sqlite and nginx confs are root-owned; edit with sudo. Reload only after `nginx -t`. HTTP-only vhosts are expected until public DNS exists for Let's Encrypt.
8. Smoke without printing secrets: `/health`, 402 at zero balance, one funded 200, `https://api.luv13.com/health`, HLS. Use `docker exec -i` when piping a Python script.

## Pitfalls
- Canonical domain is `luv13.ai` on the mini-PC (`71.209.199.134`). Do not invent AWS or use `luv.ai` as a live origin. HTTP-01/NPM certs need Cloudflare DNS-only (grey cloud) A records for `luv13.ai` and `api.luv13.ai`.
- Host-header probes on `:80` can pass while public HTTPS still fails for missing DNS/certs.
- `luv13.ai` / `api.luv13.ai` DNS may exist but be Cloudflare-orange-clouded (`104.x`/`172.x`). HTTP-01 needs grey-cloud A records to `71.209.199.134`. Orange-cloud + Cloudflare certs can still serve HTTPS without NPM LE.
- Rollback dir `/home/kor/luv13-api/rollback` is root `0700`; list backups with sudo.
- `docker exec luv13-api python - <<'PY'` without `-i` silently eats the script.
- Cookie `Domain=.luv13.ai` is ignored by browsers on `api.luv13.com`; cross-subdomain sessions need `api.luv13.ai` HTTPS.

## Verification
- [ ] Rollback directory contains a restorable DB with matching pre-migrate counts.
- [ ] `curl http://127.0.0.1:4100/health` and `https://api.luv13.com/health` return 200 after rebuild.
- [ ] Live models shape has positive integer `rate_umicro_per_million` for `luv-1` and `luv13-glm-5.2`.
- [ ] Proxy container created-at is unchanged.
- [ ] Stripe secret presence is reported as absent-or-present, never printed.

## Usage
- 2026-08-14: Wallet API + web container deploy; NPM HTTP vhosts.
- 2026-08-14: Domain correction — live origins are `luv13.ai` / `api.luv13.ai` on the mini-PC. Stripe LIVE keys remain a human gate. Cloudflare grey-cloud DNS is the remaining human step if records are missing or proxied.
- 2026-08-14: Origin cutover applied on `kor` (NPM host 55 `luv13.ai`→:3100; host 34 already had `api.luv13.ai`+`api.luv13.com`). Public DNS exists but is orange-clouded.
