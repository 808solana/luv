---
name: luv13-production-deploy
description: Use when deploying LUV13 web/API to SSH host kor (Debian 13 mini-PC, Tailscale). Tar-over-ssh, preserve live secrets, rebuild luv13-web. Do not invent Stripe or DNS.
created: 2026-08-14
updated: 2026-09-13
tags: [deploy, docker, kor, tailscale, nginx-proxy-manager, sqlite, stripe]
---

# LUV13 Production Deploy

## When to Use
- Shipping current local `web/` (or full tree) to SSH host `kor`.
- Rebuilding the live site container after local UI changes.
- API deploys that must merge live `config.json` / preserve Stripe.
- Don't use for proxy-DB writes or inventing secrets. Don't use when Tailscale/`ssh kor` is down — wait for the overlay.

## Host map
- SSH: `Host kor` in `~/.ssh/config` → Tailscale `100.90.62.96`, user `kor`, key `~/.ssh/id_ed25519_homelab`. Public IP `71.209.202.110`. OS Debian 13 (trixie). Briefing `idk/kor.md` (credentials — never paste).
- **No container named `luv13` or `lub13`.** Live website is **`luv13-web`** (`3100→3000`). API `luv13-api` (`4100`). Proxy `luv13-proxy` (`4000`).
- Paths: live web `/home/kor/luv13-web`, live API `/home/kor/luv13-api`, proxy `/home/kor/neuralwatt-proxy`, source dump `/home/kor/luv`.
- Do not bind LUV13 web to host `:3000` (korgems uses it). NPM `luv13.ai` → `:3100`.

## Steps (web / “push all the code”)
1. `ssh -o BatchMode=yes -o ConnectTimeout=15 kor 'hostname; docker ps --filter name=luv13'`. If Tailscale is off, stop and ask; do not fall back to printing passwords.
2. Optional full-tree dump to `/home/kor/luv` (source snapshot, not the running image).
3. Stream web with macOS `COPYFILE_DISABLE=1`. Exclude `node_modules`, `.next`, `.git`, `.env*`, `docker-compose.yml`. Preserve remote `.env.production` + `docker-compose.yml`.
3b. **Deleted/renamed local files linger remotely** — tar-over-ssh does not delete. Before rebuilding, `rm -f` each path the local tree removed (e.g. replaced components). Confirm nothing still imports them. Otherwise stale modules stay in the image.
4. `cd /home/kor/luv13-web && docker compose up -d --build`. Recreates **`luv13-web` only**.
5. Smoke on-box: `:3100/api/health`, `:3100/`, Host-header `luv13.ai` on `:80`. Confirm `luv13-api` / `luv13-proxy` Created timestamps unchanged unless those services were in scope.

```
export COPYFILE_DISABLE=1
cd /Users/real/luv/web
tar czf - --exclude='node_modules' --exclude='.next' --exclude='.git' \
  --exclude='.env' --exclude='.env.local' --exclude='.env.production' \
  --exclude='docker-compose.yml' --exclude='.DS_Store' .
  | ssh kor 'cd /home/kor/luv13-web && tar xzf -'
ssh kor 'cd /home/kor/luv13-web && docker compose up -d --build'
```

## Steps (API — only when local is ahead)
1. Rollback copy of live `.env` / `config.json` / DB into `/home/kor/luv13-api/rollback/<stamp>/`.
2. WAL checkpoint + `VACUUM INTO`; integrity_check `ok`.
3. Tar `api/app` + Dockerfile + `requirements.txt`. Exclude `.env`, `config.json`, `data/`, `.git`. **Do not overwrite live `app/billing.py` if remote still has Stripe `managed_payments` and local does not.**
4. `cd /home/kor/luv13-api && docker compose up -d --build`. Config-only edits: `docker restart luv13-api`.
5. Never copy local `proxy/` onto `/home/kor/neuralwatt-proxy`.

## Pitfalls
- Speech “luv13” / typo “lub13” = container `luv13-web`, not a rename. Do not `docker rename`.
- **Tar sync never deletes.** If a local component is deleted/renamed, the old file survives on the box and can end up in the image. `rm -f` those paths before `docker compose up --build`.
- Homepage copy strings change often; don’t verify by grepping for an old phrase. Grep current markers (e.g. `Hosted By Neuralwatt.com`, `Per Million Tokens`, a model name). Client-only text (cycling words, char-split reveals) won’t appear in SSR HTML.
- Stale notes citing `71.209.199.134` are wrong; origin is `71.209.202.110`.
- Local API scrap can lag live `billing.py`. Prefer dump-to-`/home/kor/luv` over clobbering `/home/kor/luv13-api`.
- `kor.md` has SSH password — exclude it from dumps; never echo it.
- macOS tar writes `LIBARCHIVE.xattr.*` warnings on Debian; harmless. `COPYFILE_DISABLE=1` avoids `._*` AppleDouble files.
- Public DNS may fail from the agent env; use `curl -H "Host: luv13.ai" http://127.0.0.1:80/` on kor.
- `docker compose up` in `/home/kor/luv13-web` must not restart Hermes, AgentDesk, or the proxy.

## Verification
- [ ] `docker ps --filter name=luv13-web` is Up on `3100→3000`
- [ ] `curl http://127.0.0.1:3100/api/health` → 200
- [ ] Homepage HTML contains the current local markers (not the previous hero/splash)
- [ ] `curl -H "Host: luv13.ai" http://127.0.0.1:80/` → 200
- [ ] Proxy Created timestamp unchanged unless proxy was in scope
- [ ] Live `.env.production` / API `.env` / `config.json` / `data/` not overwritten

## Usage
- count: 8
- 2026-08-14: Wallet API + web container deploy; NPM HTTP vhosts.
- 2026-08-14: Domain correction — live origins are `luv13.ai` / `api.luv13.ai`. Stripe LIVE keys remain a human gate.
- 2026-08-14: Origin cutover on `kor` (NPM `luv13.ai`→:3100).
- 2026-09-08: Web remake via tar-over-ssh; preserved `.env.production` + `docker-compose.yml`; rebuilt `luv13-web`. Public IP `71.209.202.110`.
- 2026-09-13: Full working tree dumped to `/home/kor/luv`; live web tar’d to `/home/kor/luv13-web`; `luv13-web` rebuilt. API/proxy left running. Tailscale path `ssh kor`.
- 2026-09-13 (pm): Re-deploy after privacy/terms pages + hero marquee/chart/slides changes. Same flow; `luv13-web` recreated 18:09 local. `/`, `/privacy`, `/terms`, `/api/health`, vhost all 200; fonts + rasters 200; API/proxy Created unchanged.
- 2026-09-14: Re-deploy after `text-marquee` / `decrypt-text` / `cycling-words` were replaced by `vertical-cut-reveal`. Removed those three stale files on the box before rebuild (tar sync doesn’t delete). Hero copy now “Hosted By Neuralwatt.com”. `luv13-web` recreated 20:50 local; all routes 200; API/proxy untouched.

## Verify the `/BRAND_ASSETS` navigation guard
`middleware.ts` blocks document navigations via the `Sec-Fetch-Dest: document` request header. Plain `curl` does **not** send it, so a bare `curl .../BRAND_ASSETS/models/x.jpg` returns 200 and looks like the guard is broken. To test it, send the header:
```
curl -o /dev/null -w '%{http_code}\n' -H 'Sec-Fetch-Dest: document' http://127.0.0.1:3100/BRAND_ASSETS/models/kimi.jpg   # 404
curl -o /dev/null -w '%{http_code}\n' -H 'Sec-Fetch-Dest: image'    http://127.0.0.1:3100/BRAND_ASSETS/models/kimi.jpg   # 200
```
