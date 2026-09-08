# kor.md — Server Briefing for Cursor / Remote Agents

> **What this is:** A one-file map of the `kor` Debian server (the user's "mini PC"
> box). If you (an AI coding agent) have SSH'd or been dropped onto this host, this
> file tells you **what runs here, where it lives, and how to work on it safely.**
> Read it before touching anything. Credentials are included — treat them as
> sensitive, never paste them into public commits, logs, or third-party tools.

---

## 1. Host Overview

| Field | Value |
|---|---|
| Hostname | `kor` |
| OS | Debian GNU/Linux 13 (trixie) |
| User | `kor` (home `/home/kor`) |
| Public IP | `71.209.202.110` |
| Tailscale IP | `100.90.62.96` |
| SSH | port `22`, key + password |
| Shell state | `bash` |

### SSH Access

```
ssh kor@100.90.62.96        # tailscale (preferred if on the tailnet)
ssh kor@71.209.202.110      # public / direct
password: Johncena83
```

There is also an ed25519 key at `/home/kor/.ssh/id_ed25519` (public `.pub` lives
alongside). Prefer key auth; the tailnet IP `100.90.62.96` is the private overlay
and is the most reliable inbound path.

> ⚠️ **Sudo:** the `kor` user is in `sudo` in many contexts but NOT universally.
> If a command needs elevated rights, try `sudo`; if it fails, stop and ask the
> user rather than working around it. **Never** `sudo`-modify `.hermes/`, the
> Docker daemon, or systemd units without the user's explicit go-ahead.

---

## 2. The Big Rule: Hermes Lives Here

This machine runs **Hermes Agent v0.20.0** — the user's personal AI agent (the
thing that may have delegated you here). It is a **live, long-running system**,
not a disposable sandbox. Two invariants:

1. **Do not kill, restart, or reconfigure the Hermes gateway or any running
   container** unless the user explicitly asks. A restart drops active sessions.
2. **Do NOT `docker rm` a container** to "clean up." The writable layer is
   destroyed with it. If you must remove one, `docker commit` / `docker cp` the
   state out FIRST. (This box has burned the user on this exact mistake.)

---

## 3. Hermes Install & Config

| Path | What it is |
|---|---|
| `/home/kor/.hermes/` | Hermes home (config, profiles, skills, cron, gateway) |
| `/home/kor/.hermes/config.yaml` | Main config (models, providers, MCP servers) |
| `/home/kor/.hermes/.env` | **Secrets** — Discord bot token, OpenRouter key, Photon creds, API keys. Do NOT read/echo values; names only. |
| `/home/kor/.hermes/gateway/` | Gateway runtime (log, pid, state) |
| `/home/kor/.hermes/hermes-agent/` | Hermes source tree (dev) |
| `/home/kor/.hermes/profiles/` | Isolated profiles: `economist`, `helper`, `money-economist`, `researcher` |
| `/home/kor/.local/bin/hermes` | CLI binary |

Key commands: `hermes --version`, `hermes config set ...`, `hermes tools`,
`hermes setup`, `hermes mcp add ...`. Config changes to MCP servers require a
`/reload-mcp` in-chat; new tools appear **next session**, not immediately.

### The live gateway

- PID file: `/home/kor/.hermes/gateway.pid`
- Log: `/home/kor/.hermes/gateway/gateway.log`
- Connected platforms: **Discord** and **Photon** (Spectrum). Discord bot is
  profile `default` (name "OWL", client `owl-alpha`).

**Platform rule for you:** You cannot verify this from a chat — you only see what
the user messages you directly. You CANNOT search channel history, pin messages,
manage roles, or list members. Don't promise to.

---

## 4. The Business: LUV13

The user's product is **LUV13** — an AI API service with a Next.js marketing/
customer site, a FastAPI backend, and an nginx proxy layer. Everything is
containerized.

| Service | Local path | Container | Host port → container | Public URL |
|---|---|---|---|---|
| Website (Next.js 16) | `/home/kor/luv13-web` | `luv13-web` | `3100 → 3000` | `https://www.luv13.ai` |
| API (FastAPI) | `/home/kor/luv13-api` | `luv13-api` | `4100 → 4100` | `https://api.luv13.ai` |
| Proxy (NeuralWatt) | (proxy repo) | `luv13-proxy` | `4000 → 4000` | — |
| API docs/config | `/home/kor/luv13-api/docs` | — | — | — |

### Rebuild / redeploy

```
cd /home/kor/luv13-web  && docker compose up -d --build   # frontend
cd /home/kor/luv13-api  && docker compose up -d --build   # backend
```

**Verify** after any deploy: open `https://www.luv13.ai/login` and confirm it
loads. Never claim a deploy "works" without checking `docker ps` health + the
public URL.

### What runs inside the containers
- **web** — Next.js 16 App Router, Tailwind **v4** (CSS-first: `@import "tailwindcss"`),
  `output: 'standalone'`. Source-of-truth docs: `../docs/SPEC.md`, `../docs/PLAN.md`.
  Brand: logo `public/BRAND_ASSETS/LUV13.png`, bg `#ffffff`, text `#0d0c12`,
  button `#675c56`, voice "we". Never put internal provider/model slugs on the public site.
- **api** — FastAPI, session-cookie auth, Stripe Checkout, wallet, API-key lifecycle,
  `requirements.txt`, `docs/`. Internal key mint: `mint_internal_key.sh`.

### Architecture note
Site calls the API at `https://api.luv13.ai` (configurable via
`NEXT_PUBLIC_LUV13_API_BASE`). Customer account routes are credentialed
(`credentials: "include"`). **Full API keys are one-time secrets** — hold them in
transient state only, never log or persist.

---

## 5. Docker Inventory (all live containers)

```
luv13-web          Up         3100->3000
luv13-api          Up         4100->4100
luv13-proxy        Up         4000->4000
agentdesk          Up (h)     6080->80    (AgentDesk desktop, noVNC :6080)
agentdesk-browser  Up         9222->9223  (CDP browser)
qa-ubuntu-desktop-1 Up (h)    6081->80    (ubuntu desktop)
relay-relay-1      Up         8788->8000  (relay service)
relay-postgres-1   Up         5432        (postgres 16)
nginx-proxy-manager-stack-app-1 Up  80/81/443  (reverse proxy / TLS)
hls-nginx          Up         8082->80    (HLS video nginx)
portainer          Up         8000/9443   (container management UI)
cloudflare-ddns-luv13    Up  (DDNS for luv13)
cloudflare-ddns-korgems  Up  (DDNS for korgems)
cloudflare-cloudflare-ddns-1 Up (DDNS)
```

`docker ps -a` / `docker stats` to inspect. When you change a service's image,
prefer `docker compose up -d --build` over manual `docker run`/`docker restart`.

---

## 6. Systemd Services (host-level, not container)

| Unit | Purpose |
|---|---|
| `agentdesk-api.service` | AgentDesk control API (:7070) |
| `core-desktop-xvfb.service` | Xvfb virtual framebuffer (display `:2`) |
| `core-desktop-lxde.service` | LXDE desktop session (display `:2`) |
| `core-desktop-vnc.service` | x11vnc, display `:2`, port `5902` (pw `Johncena83`) |
| `core-desktop-novnc.service` | noVNC web access, port `6085` (`/vnc.html`) |

The "core desktop" is a shared LXDE desktop over noVNC with the host filesystem
(`/home/kor`) shared in. It's the user's hands-on web UI — **don't kill it.**

**Ports you'll care about (listen map):** `22` ssh · `80/81/443` nginx-proxy-manager ·
`3000` (dev) · `3100` web · `4000` proxy · `4100` api · `5900/5902` VNC ·
`6080/6081/6085` noVNC · `7070` agentdesk API · `8000` portainer · `8082` HLS ·
`8787/8788` relay · `9222` CDP browser · `9443` portainer-HTTPS.

---

## 7. AgentDesk (Desktop Automation)

- Home: `/home/kor/agentdesk/`
- Control API on `:7070`; noVNC `:6080`; CDP `127.0.0.1:9222`
- Core desktop (separate): Xvfb `:1`/`:2`, noVNC `:6085`/`vnc.html`, VNC `5902`
  (pw `Johncena83`), shared FS `/home/kor`. Unit files under `/home/kor/core-desktop/`.
- Reports/handoffs: `AGENTDESK_FULL_REPORT.md`, `AGENTDESK_HANDOFF_v2.txt`
- **Docker safety applies here too** — read `bootstrap.sh` before re-provisioning.

---

## 8. MCP Servers

Registered in `/home/kor/.hermes/config.yaml` under `mcp_servers`. Reload with
`/reload-mcp` in-chat; tools go live **next session**. Notable:
- **HYDRA MCP** — public keyless endpoint `https://mcp.luv13.com/mcp`; container
  `hydra-mcp`; source `/home/kor/mcp-server/`; registered as stdio
  `python3 /home/kor/mcp-server/hydra_mcp.py`.
- **Pythia MCP** — the user's PRIMARY news/markets/world-events feed. Always query
  it before `web_search` for current events, economics, geopolitics, markets.
- **Cloudflare MCP** — DNS/OpenAPI ops (uses `MCP_CLOUDFLARE_API_KEY`).

---

## 9. College Agents Fleet

The user runs a fleet of isolated Hermes agents ("college agents"). **Each agent
is a fully separate Hermes profile** with its own `SOUL.md` + `memories/` — no
state bleeds between them.

- Profile brain files: `/home/kor/college-agents/hermes_<name>_agent_role_context_memory.md`
  - `economist` · `general` · `helper` · `money_economist` · `researcher`
- Shared context: `/home/kor/college.md` + `/home/kor/Notes.md`
- `economist` is live: profile `economist` (DeepSeek) + container `economist-agent`
  (`hermes-agent:latest`), profile home `/home/kor/.hermes/profiles/economist/`
- Per-agent isolated homes: `/home/kor/.hermes/profiles/{economist,helper,money-economist,researcher}/`

**Rule:** never cross-write another profile's `skills/`, `plugins/`, `cron/`, or
`memories/` unless the user explicitly asks.

---

## 10. Google Workspace

- Live for `ilovesolbtc@gmail.com`. Token: `/home/kor/.hermes/google_token.json`,
  client secret: `/home/kor/.hermes/google_client_secret.json`.
- Run Google scripts with `/home/kor/.hermes/venv/bin/python` (system pip is
  externally-managed on Debian 13).

---

## 11. Workflow Rules for Cursor / the Agent

- **"Types but never responds"** in Discord = user auth blocking the reply. Check
  `gateway.log` for `Unauthorized user`. Fix = open access or allowlist the user
  in gateway config, restart gateway.
- **Never echo secrets back.** When you encounter a key/token, refer to it by name
  (e.g. "the Discord bot token"), never the value.
- **Verify, don't gesture.** After any build/deploy/test, show real command output
  (`docker ps`, `npm run build` exit code, `curl` of a health endpoint). If you
  can't actually run something, say so — never fabricate a result.
- **Write files reliably:** for anything with credentials or non-trivial content,
  write via heredoc + `py_compile` + read-back, or `write_file`. Prefer bland
  variable names for secrets pulled from 0600 files.
- **UI answer format:** the user reads on phone. Respond in plain text with
  A/B/C lettered options — NOT multi-choice UI buttons.
- **Timezone:** America/Phoenix (no DST). Reminders: 1-day + 2-hr.
- **Don't modify another profile's state** (see §9).

---

## 12. Quick Reference Cheat Sheet

```
# host/ip
hostname                 # -> kor
# health
docker ps
systemctl --type=service --all | grep -iE "core-desktop|agentdesk"
# rebuild frontend
cd /home/kor/luv13-web && docker compose up -d --build
# verify deploy
docker ps --filter name=luv13-web
curl -sI https://www.luv13.ai/login | head -1
# hermes
hermes --version
cat /home/kor/.hermes/gateway.pid
```

---

*Generated for the `kor` Debian server. Keep this file in the repo the Cursor
agent uses. Credentials inside are sensitive — keep them out of public branches
and third-party tools.*
