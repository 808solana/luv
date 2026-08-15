# AGENT_MEMORY

## User Preferences & Conventions
- User wings it; brainstorm and explore before building.
- Direct, no filler. Prefers simple/simple/simple.
- LUV13 voice is "we", not founder-centric. Avoid autobiography about the founder.
- Treat `@BRAND_ASSETS` as the source of truth for logo and typography.
- Do not mention OpenRouter anywhere on the public site.

## Project Facts
- Project: **LUV13** — LLM hosting provider, launching with GLM-5.2.
- Current workspace: `/Users/real/luv` on macOS. Older deployment/workflow notes may still reference the previous Windows path.
- Existing: `.cursor\skills\`, `BRAND_ASSETS\`, `from-thinking-to-coding\`, `web\` (Next.js 16 app).
- App lives in `web/` — Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4.
- Web routes include `/`, `/signup`, `/login`, and `/dashboard`; `/keys` and `/top-up` redirect into the authenticated dashboard.
- UI deps: `framer-motion` (animations), `lucide-react` (icons), `gsap` (installed but no longer used by the scroll-video background), `hls.js` (HLS source support — not exercised for local mp4, falls to direct src).
- Static assets served from `web/public/` (NOT repo-root `BRAND_ASSETS/`). Copy assets into `web/public/BRAND_ASSETS/` to make them reachable at `/BRAND_ASSETS/...`.
- `web/components/scroll-video-background.tsx`: Fixed full-page video background for the whole site (mounted in `layout.tsx`, not page.tsx). Uses a native passive `scroll` listener to set `video.currentTime = (scrollY / maxScroll) * duration`. No canvas, no frame cache, no mouse parallax. Video element uses `object-contain` (NOT `object-cover`) so the full frame is always shown at a constant zoom regardless of viewport size — `object-cover` caused an apparent "zoom in" on wide desktop screens and "zoom out" on small windows. Letterbox bars blend into the black `html` background. Loading overlay until `canplay`.
- Background video source in `layout.tsx`: self-hosted HD HLS `https://video.korgems.com/stream/index.m3u8` (5K@24fps, single 8s segment with B-frames). Was Mux HLS `https://stream.mux.com/LtB1WEO01Zzf2x...m3u8` (blurry due to top rendition 4K + auto-level selection), switched to self-hosted for sharpness. Local `backgroundyesyes.realesrgan.mp4` and earlier `filename*.m2ts/.m3u8` files no longer present in `web/public/BRAND_ASSETS/` (only `LUV13.png` and `typography.png` remain).
- Frame extraction cap is display-driven: `scale = min(1, innerWidth*dpr / videoWidth)` (dpr capped at 2), then clamped against a ~1GB decoded-frame budget. NOT the original fixed 1280. Extracting above display res is invisible; full 5K x ≤120 frames ≈ 7GB and crashes the tab.
- For the video to show site-wide: `body { background: transparent }`, `html { background:#000 }`, page root is `relative z-10`. No white backgrounds anywhere on the page — all sections are transparent over the video background with white text. `liquid-glass` and `liquid-glass-strong` classes may still exist in CSS but are no longer used on page sections.
- API wallet source of truth is integer micro-dollars: `users.balance_umicro`; exact per-request reconciliation uses `requests.charge_umicro`. `requests.cost_usd` is display-only.
- Stripe amounts remain integer cents and convert with `cents * 10_000`; GLM charges use integer floor math at `330_000` µ$ per million tokens.
- API model configuration uses canonical `luv13-glm-5.2` plus permanent compatibility alias `luv-1`, both routing to `glm-5.2`; do not add legacy suffixed proxy slugs.
- API credit enforcement reserves estimated input plus exactly 8,000 output tokens with `BEGIN IMMEDIATE`; low balances use a configurable output floor and an affordable upstream output cap.
- API reservation settlement is idempotent and atomically refunds unused µ$, finalizes the reservation, and inserts the usage row on normal, error, cancellation, or forced-cut paths.
- Uvicorn runs with proxy-header support; deployment must set `FORWARDED_ALLOW_IPS` to the exact trusted reverse-proxy IP/CIDR for real per-IP auth throttling.
- Stripe Checkout creates a persisted pending top-up first; only a raw-body signature-verified, paid `checkout.session.completed` event with matching persisted amount/user/session identifiers may atomically credit `amount_cents * 10_000`.
- Stripe redirects and browser input never credit wallets; webhook replay protection is transactional and concurrent-safe.
- Chat request shapes are validated before reservation; all post-reservation work transfers one exactly-once settlement guard into the stream relay.
- Reservation input uses a conservative UTF-8 byte upper bound, while missing-usage billing uses chars/4; tool-call output without trustworthy usage retains the bounded reserved output amount.
- Stripe Checkout uses deterministic `luv13-topup-{id}` idempotency keys; signed webhook metadata can reconcile a pending top-up when local session attachment failed.
- API config loading migrates the legacy global float-rate/string-model shape in memory while preserving root secrets; enabled model rates must be positive integers.
- Browser account integration lives in `web/lib/api.ts`, defaults to `https://api.luv13.ai`, and always sends `credentials: "include"`.
- The customer dashboard reads cookie-scoped balance, key metadata, and recent usage; full API-key secrets exist only in transient post-create component state.
- `GET /api/usage` returns recent session-user usage without exposing upstream model aliases or key hashes.
- Production SSH alias is `kor`. API lives at `/home/kor/luv13-api`, proxy at `/home/kor/neuralwatt-proxy`, deployed web at `/home/kor/luv13-web` on host port 3100. Do not bind LUV13 web to host port 3000; NPM already forwards `korgems.com` there.
- Canonical public domain is **luv13.ai** on the mini-PC only (`71.209.199.134`). Dashboard `https://luv13.ai`, API `https://api.luv13.ai`, Stripe webhook `https://api.luv13.ai/billing/webhook`, top-up `https://luv13.ai/top-up`. Cookie Domain `.luv13.ai`; CORS/`FRONTEND_URL` `https://luv13.ai` (credentialed). Do not use `luv.ai` as a live origin; AWS/Route53 for `luv.ai` was the wrong domain.
- `https://api.luv13.com` remains a working legacy hostname (PATH-0 / public metered path). Keep that operational fact. Host Cloudflare DDNS containers cover `luv13.com`, `korgems.com`, and `korwants.com` — not the `luv13.ai` zone.
- Host Stripe LIVE secret and webhook signing secret are a human gate; do not invent them. Checkout success/cancel URLs must be `https://luv13.ai/top-up/success?...` and `https://luv13.ai/top-up`.
- Live API cookie domain is `.luv13.ai` and CORS origin is `https://luv13.ai` only. Restorable origin-cutover backup: `/home/kor/luv13-api/rollback/20260814T204755Z-luv13ai-origin`. Pre-wallet backup remains `/home/kor/luv13-api/rollback/20260814T061500Z-pre-wallet`.
- `luv13.ai` NS are Cloudflare (`etta.ns.cloudflare.com` / `tony.ns.cloudflare.com`). Public A/AAAA for `luv13.ai` and `api.luv13.ai` currently resolve to Cloudflare proxy IPs (`104.21.40.96`, `172.67.183.210`, `2606:4700:...`) — orange cloud, not DNS-only to `71.209.199.134`. Public HTTPS through Cloudflare currently returns 200 for apex and API health. `www.luv13.ai` is 520 (no NPM vhost). HTTP-01 / NPM origin certs still need grey-cloud A records to `71.209.199.134`.

## Environment
- Current local OS: macOS (Darwin), zsh. Older notes below may describe the previous Windows environment.
- Default new-project stack per repo: React / TypeScript / Tailwind frontend; Python or Node backend.
- FFmpeg installed via winget (`Gyan.FFmpeg`). Current shell may not see PATH immediately; binary path: `C:\Users\jgran\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe`.

## 21st.dev Theme Install
- `web/components.json` exists (hand-crafted, NOT via `shadcn init` — init rewrites `globals.css`). new-york style, neutral base, lucide icons, `@/*` aliases.
- Theme color format (Serafim "Vercel"): **oklch channel triplets** (space-separated `L C H`), NOT HSL. Bridge in `@theme inline` is `oklch(var(--background))`, not `hsl(var(--background))`.
- Public 21st.dev themes need NO API key. The `21st_sk_...` key in chat should be rotated (it only matters for private/publish).
- Fetching theme CSS that 404s on `/r/...` URLs: open the theme page (`https://21st.dev/@<user>/<type>/<slug>`) with the cursor-ide-browser MCP, then read tokens via `getComputedStyle(document.documentElement)`. To get LIGHT values when the page defaults to dark (`html.dark`), temporarily `classList.remove('dark')`, read, restore. The "Copy CSS" button requires auth + clipboard focus and is unreliable in a backgrounded tab — computed styles are the reliable path.
- `npm run build` exits 0; `/api/health` returns 200 after the merge. `globals.css.bak` kept for reversibility.

## Tooling Notes
- `.cursor\skills\tooling\project-setup.md` is for the previous Love AI project, not LUV13. Do not follow it directly for this project.
- PowerShell session does not accept `&&` as a statement separator (CMD-era). Use `;` or the `working_directory` param / Set-Location. `cd path && npm run dev` throws `InvalidEndOfLine`.
- A second `npm run dev` on port 3000 fails ("Another next dev server is already running"); the first one (PID tracked in `web/.next/dev/logs/`) hot-reloads on save. Don't spin a second dev server — just edit and the running one picks it up.
- React hydration error in dev surfacing as "attributes of the server rendered HTML didn't match the client" with `data-cursor-ref="..."` diffs on every element is caused by the **TronLink** browser extension injecting attributes before React hydrates (dev log even says "browser extension installed which messes with the HTML before React loaded"). It is NOT a code bug — do not chase it. Same overlay is also where `Image` aspect-ratio warnings (`/BRAND_ASSETS/LUV13.png` width/height) come from; those are real but cosmetic.

## Copy-to-Clipboard Pattern (client component)
- Use `navigator.clipboard.writeText()` with an `execCommand('copy')` textarea fallback for non-secure contexts / old Safari.
- Cross-fade the check / copy icons per `make-interfaces-feel-better` §7: `opacity` + `scale 0.25↔1` + `filter blur 4↔0`, spring transition with `bounce: 0` (the skill hard-requires bounce 0). Wrap in `<AnimatePresence initial={false}>`.

## Lessons Learned
- Server Components in Next 16 App Router cannot receive event handlers (onMouseEnter etc.). Use pure CSS for hover states, or extract the interactive piece into a `"use client"` component.
- Don't hardcode anchors that don't exist — every nav `href="#..."` must point to a real `id` on the page, or it silently no-ops.
- The "no OpenRouter on public site" constraint is easy to violate in feature copy. Re-check feature/checklist text against it before finishing.
- `backgroundyesyes.mp4` is a local mp4, NOT a Mux/HLS stream — hls.js isn't exercised for it; the direct `video.src` path runs. Keep hls.js dynamic-imported so mp4 doesn't pay for it.
- Scroll-scrubbed video: current user preference is native passive `scroll` listener driving `video.currentTime` directly. No GSAP ScrollTrigger, no canvas/frame-cache, no mouse parallax, no zoom scaling. If direct seeking is still choppy, the real fix is re-encoding the source with dense keyframes / short GOP + multi-segment HLS (`ffmpeg -i in.mp4 -g 1 -c:v libx264 -f hls -hls_time 1 -hls_playlist_type vod out.m3u8`), NOT more JS. Confirmed in real bug: a single 8s `.ts` at 5120x2880 with B-frames was choppy on scrub; Mux's multi-segment multi-bitrate rendition was smooth. Dense keyframes + short segments lets the browser seek cheaply and decode small chunks.


# AGENTS.md — luv13

> **Living doc.** This is the source of truth for any coding agent (Cursor, etc.) working on luv13. It is updated conversationally after each planning session. Read it top to bottom before making a plan.
> **Last updated:** 2026-08-13 · **Owner:** Javier · **Goal:** ship the customer credit + payment + dashboard flow **tonight**.

---

## 0. What luv13 is (and why it exists)

luv13 is a **metered LLM proxy**. It fronts top models (GLM-5.2, Kimi K2, and more) by rotating across a pool of ~10 Neuralwatt accounts, and resells access as pay-as-you-go credit. Customers get their own API keys and a dashboard; they call luv13 like any OpenAI-compatible endpoint.

### The wedge — this is the whole positioning, do not lose it

**luv13 is cheaper. Full stop.** Neuralwatt's raw cost undercuts OpenRouter and the frontier providers, and we pass that on. Everything in the product — copy, UI, pricing display — should reinforce *cheapest access to top models, no rate limits.*

We are **not** trying to out-feature OpenRouter. Feature-for-feature we look similar (many models, one balance, pay-as-you-go). The differences that matter:

- **For the purist** (lives in API-land, connects APIs to coding agents): *cheaper frontier tokens than anywhere, no per-account rate limits, connect to Cursor in two minutes.*
- **For the tourist** (has never touched an API, may still be on ChatGPT/JWT because they don't know better): *load \$10, use the best models, no subscription, no API knowledge required.* luv13 is the one place a non-technical person can actually use frontier models without understanding any of it.

**The through-line that unifies both audiences is price.** OpenRouter's UI is built by engineers for engineers; it's intimidating to a tourist. luv13 walks the lane OpenRouter never has: dead-simple, cheapest door in.

### Honest risk (informs "ship fast")

The moat is Neuralwatt's pricing + the account-rotation trick. If Neuralwatt raises prices or clamps multi-account usage, the wedge narrows. This is not a reason to slow down — it's the reason to **ship while the arbitrage is wide open.**

---

## 1. Architecture (current, live)

```
Browser / Cursor / any OpenAI client
        │
        ▼
  luv13-web (Next.js 16)          ← marketing site + customer dashboard. PARTIALLY BUILT / not fully deployed.
        │  (cookies forwarded server-side)
        ▼
  luv13-api (FastAPI, :4100)      ← THE PRODUCT. Auth, users, API keys, usage metering, credit, payment.
        │  (Bearer internal key)     ALL business logic lives here.
        ▼
  luv13-proxy / neuralwatt (Flask, :4000)  ← DUMB PIPE. Neuralwatt key rotation, streaming, stall detection.
        │                                     DO NOT add business logic here. See §6.
        ▼
  Neuralwatt (hosts GLM-5.2, Kimi K2, etc.)
```

| Container | Port | Role | Touch tonight? |
|---|---|---|---|
| `luv13-api` | 4100 | FastAPI — auth, keys, **credit, payment, dashboard API** | ✅ **Yes — almost all work is here** |
| `luv13-proxy` | 4000 | Flask — key rotation, streaming | ❌ No (except the one-time key fix in §2) |
| `luv13-web` | 3000 | Next.js — dashboard + hero UI | ✅ Yes — dashboard sections + top-up modal |

**Server:** Debian mini-PC. Live paths: `/home/kor/luv13-api/`, `/home/kor/neuralwatt-proxy/`, `/home/kor/luv13-workspace/luv/web`.

**Deploy notes that matter:**
- `luv13-api/app/` is **NOT** volume-mounted — code changes ship via **image rebuild** (`docker compose up -d --build`).
- `luv13-api/config.json` **IS** bind-mounted read-only — config changes need only `docker restart luv13-api`, **no rebuild**.
- `luv13-api/.env` is bind-mounted via `env_file`. Secrets live here (mode 600, gitignored).

---

## 2. 🚨 PATH-0 BLOCKER — fix before anything else is testable

**The metered customer path is currently dead end-to-end.** A luv13 API key authenticates correctly at luv13-api, but the request then returns **401 from the Flask proxy** because the internal `upstream_api_key` in `luv13-api/config.json` no longer exists in the proxy's DB (the proxy DB was rebuilt during earlier work; it now holds only key id 18).

Until this is fixed, **you cannot test credits, metering, or anything end-to-end** — every metered call 401s at the proxy.

**Fix (one-time, minimal):**
1. On `luv13-proxy`, mint a fresh internal key using the existing script (`generate_api_key.py` / the skill's key generator). **Do not hand-write DB rows.**
2. Set that key as `upstream_api_key` in `/home/kor/luv13-api/config.json`.
3. `docker restart luv13-api` (config is bind-mounted — no rebuild).
4. Verify: a Bearer call to luv13-api `/v1/chat/completions` returns a real 200 completion, not a 401.

**⚠️ STOP CONDITION:** This writes to the **proxy's** DB, which is otherwise off-limits. Before running, confirm whether the proxy **caches keys in memory at startup** vs. querying per-request. If it caches at startup, the proxy must be restarted after the INSERT for the new key to be recognized — plan for that restart. If anything about the proxy's key handling is unclear, **plan only and flag for Javier's approval** rather than guessing.

---

## 3. What's ALREADY BUILT (do not rebuild)

### Auth (live in luv13-api, 12.5/13 checks passing)
- Email/password with **bcrypt**; **JWT** sessions backed by a DB **revocation table** (logout kills the session server-side, not just by expiry).
- **Google OAuth** via manual `httpx` (no `authlib`). Degrades gracefully if Google creds absent (`/auth/google` → 503, app still boots).
- Cross-subdomain cookie: `luv13_session`, `Domain=.luv13.com`, `HttpOnly; Secure; SameSite=Lax; Max-Age=604800`. Works across `luv13.com` ↔ `api.luv13.com`.
- **Dual auth** on key management: `/api/keys` accepts **either** a session cookie (scopes to logged-in user) **or** `X-Admin-Secret` (admin). `/internal/*` remains admin-only and untouched.
- Brute-force throttle on login (per-email; see §7 for the known degradation).

### Endpoints (luv13-api)
| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /auth/signup` | none | Email+password register → sets session cookie |
| `POST /auth/login` | none | Email+password login → sets session cookie |
| `GET /auth/google` / `/auth/google/callback` | none | Google OAuth |
| `POST /auth/logout` | cookie | Revokes session (DB-backed), clears cookie |
| `GET /auth/me` | cookie | Returns `{ user, keys[], usage }` (usage = last 30d: requests, tokens_in/out/cached, cost_usd) |
| `POST /api/keys` | cookie **or** admin | Create key (full key returned once), force-scoped to session user |
| `GET /api/keys` | cookie **or** admin | List caller's keys (metadata only, never key_hash) |
| `POST /api/keys/{id}/revoke` | cookie **or** admin | Revoke (scoped; foreign keys → 404) |
| `POST /v1/chat/completions` | Bearer key | OpenAI-compatible, metered. **Streams** (see relay in §4). |

### Database (`luv13-api/data/luv13.db`, SQLite, WAL mode)
- `users` — `id`, `email` (UNIQUE COLLATE NOCASE), `created_at`, `password_hash`, `google_sub` (unique partial index), `name`, `picture_url`, `updated_at`
- `api_keys` — `id`, `user_id`, `name`, `key_hash` (UNIQUE), `key_prefix`, `created_at`, `revoked_at`, `last_used_at`
- `requests` — usage log: `ts`, `tokens_in`, `tokens_out`, `tokens_cached`, `cost_usd` (REAL), `status`, `latency_ms`, key/user linkage
- `sessions` — `id`, `user_id`, `token_hash` (UNIQUE), `created_at`, `expires_at`, `ip_address`, `user_agent`
- `login_events` — audit log

**Key generator (reuse as-is):** `db.create_key(email, name)` → `"sk-luv13-" + secrets.token_hex(24)`; sha256 hashed, prefix stored, full key returned once.

### Proxy (luv13-proxy) — mature, leave alone
Key rotation across 10 accounts, SSE streaming, stall detection, **fail-loud mid-stream death** fix, **agent-steering injection** (kills the GLM background-agent hallucination), `/admin/outcomes` panel. This layer is a solved, dumb pipe.

---

## 4. TONIGHT — Build spec

Five workstreams. Order: **§2 blocker → credit schema → enforcement → Stripe → dashboard → abuse.**

### 4.1 Credit system (the wallet)

**Model: dollar-for-dollar.** \$1 loaded = \$1 of credit. Burned down at each model's **flat rate per million *total* tokens** — **no input/output split**, one rate per model applied to `tokens_in + tokens_out`.

**Pricing (correct numbers — use these):**
- GLM-5.2: sell **\$0.33 / M** total tokens. Raw cost \$0.21/M → **\$0.12/M profit**.
- \$1 buys ≈ **3.03M** GLM tokens (`1 / 0.33`).
- Sanity check at volume: **1B tokens = \$330 revenue, \$210 cost, \$120 profit.** (A billion is 1,000 million — *not* \$1,000 of revenue.)
- Every model has its **own rate**. Kimi K2 and others each get a rate. The hero page lists all models — luv13 is a "moderator of models."

**Per-model pricing — extend `config.json`** (bind-mounted, no rebuild to change):
```jsonc
{
  "upstream_root": "http://192.168.0.150:4000",
  "database_path": "data/luv13.db",
  "listen_port": 4100,
  "models": {
    "luv-1":  { "upstream": "glm-5.2",  "rate_per_million_usd": 0.33 },
    "luv-k2": { "upstream": "kimi-k2",  "rate_per_million_usd": 0.00 }   // set real rate
    // add models here; each maps a public id → upstream slug + its own rate
  }
}
```
> Migrate the existing single `rate_per_million_usd` (0.33) into the per-model shape above. The metering code must look up the rate by the requested model, not a global constant.

**Schema additions (idempotent migration in `db.migrate()`):**
```sql
-- cached wallet balance (source of truth for fast reads + enforcement)
ALTER TABLE users ADD COLUMN credit_balance_usd REAL NOT NULL DEFAULT 0;

-- top-up log (powers the "top up" history in the dashboard; separate from usage)
CREATE TABLE IF NOT EXISTS topups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount_usd REAL NOT NULL,
    stripe_session_id TEXT UNIQUE,      -- idempotency: one credit per session
    status TEXT NOT NULL,               -- 'pending' | 'completed' | 'failed'
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_topups_user ON topups(user_id, created_at);
```

**Balance math:**
- On a **completed top-up webhook**: `credit_balance_usd += amount_usd` (atomic).
- On **each request completion**: `credit_balance_usd -= cost` where `cost = total_tokens / 1_000_000 * model_rate`.
- **Usage log UI** reads the existing `requests` table. **Top-up log UI** reads `topups`. **Balance** is the cached `credit_balance_usd` column.
- *(Upgrade path, not tonight: derive balance from a full ledger for perfect consistency. Cached column is fine at current scale.)*

### 4.2 Credit enforcement — hard cut, frictionless recovery

**Decision (final):** enforce **continuously** and **cut the stream mid-response the instant the running balance hits zero.** Every token served after zero is money out of Javier's pocket, and a "check before, settle after" model leaves a parallel-request hole (fire N requests at a tiny positive balance, all pass the pre-check). Mid-stream cutoff closes that hole.

**The subtlety Cursor must handle — usage arrives at the END.** In the OpenAI-compatible stream, the exact `usage` object only comes in the final chunk. You therefore cannot read exact tokens mid-stream. Approach:

1. **Pre-gate (hard):** at the top of `/v1/chat/completions` (both streaming and non-streaming), resolve key → user → `credit_balance_usd`. If **≤ 0**, do **not** call upstream. Return **HTTP 402 Payment Required** with a human-readable body containing the top-up link (see message spec below).
2. **Mid-stream live estimate:** inside luv13-api's `_stream_chat` relay, accumulate estimated output tokens as content deltas stream (**MVP heuristic: `chars / 4`**; upgrade to a real tokenizer later — the estimate only needs to prevent runaway overspend). Track `running_cost = est_total_tokens / 1e6 * model_rate`. When `running_cost >= credit_balance_usd`, **break the relay loop**, emit the top-up message as a final assistant content chunk, then `finish_reason` + `data: [DONE]`, and close the upstream.
3. **Settle:**
   - **Normal completion:** debit the **exact** amount from the real `usage` chunk.
   - **Forced cut:** debit the **running estimate** (you won't get a usage chunk — you killed the stream).

> This lives in `luv13-api`, **not** the proxy. `_stream_chat` is already the only layer that disassembles/reassembles the stream (it `json.loads` every `data:` line, rewrites `model`, re-serializes). The enforcement rides in that same loop. **Note:** the same relay is the suspect for the open parallel-tool-call reassembly bug (§7) — be careful not to break `tool_calls` delta framing when adding the token counter. Count tokens from `delta.content` only; leave `tool_calls` fragments untouched and forwarded verbatim.

**The "out of credits" message (the conversion moment).** When blocked (pre-gate) or cut (mid-stream), the user must see, right there in Cursor's output, a top-up prompt with a **direct link to luv13**. Two clicks → more credits → back in business. Make it a clear assistant-visible message, e.g.:

> `You're out of credits. Top up here: https://luv13.com/topup`

(Use the real top-up URL. The 402 body should carry the same text so non-chat clients surface it too. This link *is* the growth loop — keep it frictionless.)

### 4.3 Payment — Stripe Checkout (credentials already set up)

**Flow:** user picks amount → luv13-api creates a **Stripe Checkout Session** (one-time payment) for that amount → user pays on Stripe-hosted page → **Stripe fires a signed webhook** to luv13-api → webhook handler credits the wallet.

**Credit on the WEBHOOK, never the redirect.** The success redirect can be forged; the webhook is **signature-verified** with the Stripe signing secret. The redirect is only for UX ("thanks, your balance is updating"). The webhook is the money event.

**Endpoints (luv13-api):**
| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /billing/checkout` | cookie | Body `{ amount_usd }`. Creates a Checkout Session for that amount, inserts a `topups` row `status='pending'` with the `stripe_session_id`, returns the Checkout URL. |
| `POST /billing/webhook` | Stripe signature | Verify signature. On `checkout.session.completed`: look up the `topups` row by `stripe_session_id`, mark `completed`, `credit_balance_usd += amount_usd`. **Idempotent** — the `UNIQUE` on `stripe_session_id` + a status check prevents double-crediting on webhook retries. |

**Env (add to `luv13-api/.env`, gitignored):**
```
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_SUCCESS_URL=https://luv13.com/topup/success
STRIPE_CANCEL_URL=https://luv13.com/topup
```

**Top-up modal UI (luv13-web).** A popup, not a page nav:
- **"Top Up"** header, top-right of the modal.
- **Custom dollar-amount field**, centered — user can enter **any** amount.
- **Quick pills** underneath: **\$5, \$10, \$15, \$30** (extend as desired). **Tapping a pill just fills the custom field** — one code path feeds `amount_usd` into `/billing/checkout`. (Pills serve the tourist; the custom field serves the purist. Same off-white line.)
- On submit → call `/billing/checkout` → redirect to the returned Stripe URL.

### 4.4 Customer dashboard (luv13-web) — four sections, one page

All on the authenticated dashboard (cookie auth, calls luv13-api with `credentials: 'include'`). None of this needs to be perfect — MVP implementations:

1. **Balance** — current `credit_balance_usd`, prominent, **updates in real time** (poll `/auth/me` or a small `/billing/balance` endpoint; a short poll interval is fine for MVP).
2. **Usage log** — table from the `requests` table: timestamp, model, tokens, cost. Let them *see everything*. This is a trust-builder — tourists especially want to watch it tick.
3. **Top up** — the Stripe modal from §4.3, plus history from `topups`.
4. **Create new API key** — reuse `POST /api/keys` (cookie auth). Show the full key **once** on creation; list existing keys as prefix + metadata.

**Tourist-vs-purist UX:** default to plain-language labels and a "connect to Cursor in 2 minutes" quickstart for the create-key section (base URL + key + paste target). Keep the raw/advanced details available but not in the tourist's face.

### 4.5 Abuse protection (don't let jailbreaks buy free usage)

- **Zero-token / dead-stream leak (must-fix tonight-ish):** today, a dead stream with no `usage` chunk meters **0 tokens** → free request. With the mid-stream estimate from §4.2, a cut stream now debits the estimate, and a normally-completed stream debits exact — close the "no usage chunk = free" gap. Ensure **every** terminal path debits *something* sane.
- **Parallel-request race:** closed by mid-stream enforcement (§4.2) — each stream self-limits against the live balance rather than all passing a single pre-check.
- **Signup abuse:** unverified signups are currently unthrottled — a vector for mass free-account creation. Add basic throttling (per-IP signup rate limit) and keep the door open for email verification later.
- **General stance:** the pre-gate + mid-stream cut mean the worst case is a small, bounded overspend per user, not open-ended free usage. Prompt-jailbreaks can change model *behavior* but cannot mint credit — credit only moves via the signed Stripe webhook.

---

## 5. Definition of done (tonight)

- [ ] **PATH-0:** metered call through luv13-api returns a real 200 (internal key fixed).
- [ ] Per-model pricing live in `config.json`; metering charges by requested model.
- [ ] `credit_balance_usd` + `topups` migrated; balance debits on every request.
- [ ] Pre-gate returns **402 + top-up link** when balance ≤ 0.
- [ ] Mid-stream cut fires when running estimate crosses balance; emits top-up message + `[DONE]`; debits estimate.
- [ ] Stripe Checkout session creation + **signature-verified webhook** crediting the wallet, idempotent.
- [ ] Top-up modal (custom field + pills, pills fill the field) → Stripe → balance updates.
- [ ] Dashboard shows the four sections: balance, usage log, top-up, create key.
- [ ] Signup throttled per-IP.

---

## 6. Guardrails & conventions (non-negotiable)

- **`luv13-proxy` stays a dumb pipe.** No credit, auth, or business logic there. All of it in `luv13-api`. (Coupling identity/billing to transport is exactly what we've avoided.)
- **`luv13-api/app/` changes require a rebuild** (`docker compose up -d --build`); **`config.json` and `.env` changes need only `docker restart`.**
- **Never break the existing key/auth path.** `/internal/*` and `/v1/chat/completions` Bearer auth already work — don't regress them. Migrations must be **idempotent** (checked against `PRAGMA table_info` before `ALTER`).
- **SQLite gotcha:** you **cannot** add a `UNIQUE` column via `ALTER TABLE` — use a separate partial unique index (this already bit us on `google_sub`).
- **Money moves only via the signed Stripe webhook.** Redirects and client calls never credit balance.
- **Back up the DB before migrating:** `.backup` inside the container (WAL mode, root-owned dir) — same pattern as the pre-auth backup.
- **Secrets** live in `.env` (mode 600, gitignored). Never commit or print `JWT_SECRET`, Stripe keys, or admin creds.
- **Reconcile with Hermes when relevant:** Hermes runs on the server (ground truth, reads live files/containers/captures) but acts autonomously — for risky changes (esp. anything touching the proxy DB), instruct "plan only, wait for approval."

---

## 7. Known open issues / deferred (don't lose, not all blocking)

- **Parallel-tool-call freeze (open, mechanical):** Cursor can hang after emitting parallel tool calls. Prime suspect is luv13-api's `_stream_chat` relay reassembly (`aiter_lines()` is line-oriented; SSE is event-oriented; `json.loads`→mutate→`json.dumps` changes bytes; `except: pass` hides parse failures). **When adding the token counter in §4.2, do not disturb `tool_calls` delta framing.** Proper diagnosis = replay recorded parallel-call captures through the relay offline and diff. Not tonight, but don't make it worse.
- **Brute-force throttle degraded to per-email only** — uvicorn runs without `--proxy-headers`, so the IP component sees the docker/NPM peer, not the real client. Add `--proxy-headers` to the compose command to restore per-IP.
- **Password reset flow** — not implemented.
- **In-memory login throttle** — resets on restart, per-worker. Fine at current scale.
- **SQLite hot-path writes** — per-request INSERTs are blocking I/O gevent can't yield around; possible micro-stalls under real concurrency. Invisible at one user.
- **`gemma-4-31b` routing** — early captures showed it + a 404 on `luv13-gemma-4-31b`; unconfirmed whether Cursor is model-pinned.
- **SECURITY:** admin creds (`kor` + password) were exposed in chat earlier — **rotate** and change anywhere reused.

---

## 8. How this doc evolves

Javier talks through changes with Claude; Claude regenerates/updates this AGENTS.md; Javier pastes it into Cursor so Cursor is always current. Keep it succinct, keep the gold, cut the filler.
