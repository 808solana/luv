# PLAN.md — Verified Facts & Final Build Instructions

> Appended 2026-08-13 after Hermes read-only recon (no changes were made during recon). This folds verified ground truth into the plan and **closes the open "verify"/"stop-condition" items** in PLAN_ADDENDUM.md.
> **Reading order for Cursor:** `PLAN.md` (phase structure) → `PLAN_ADDENDUM.md` (corrections) → **this doc** (verified facts). Where they conflict, **latest wins — this doc is authoritative.**

---

## Verified ground truth (Hermes, on-server)

| Fact | Verified state | Consequence |
|---|---|---|
| API code deploy | `luv13-api/app/` is **baked into the image** | Code changes → **rebuild** (`compose up -d --build`) |
| API config deploy | `config.json` is a **read-only bind mount** | Config changes → host edit + **`docker restart luv13-api`** (no rebuild) |
| Databases | API and proxy use **separate WAL SQLite DBs** | Wallet migration → **API DB only**. Internal-key insert → **proxy DB only** |
| Customer slug | Live working slug is **`luv-1 → glm-5.2`** | Keep `luv-1` permanently; add `luv13-glm-5.2` as alias (see §4) |
| Prefixed slugs | `luv13-glm-5.2-fast`, `-kimi-code`, `-qwen3`, `-gemma-4-31b` belong to the **legacy proxy** | **Out of scope tonight** — do not surface or support |
| Metering unit | API stores **float USD** in `requests.cost_usd REAL` | Keep for display; wallet math moves to integer µ$ (see §3) |
| PATH-0 key | Internal key (prefix `sk-luv…`) hash is **absent from the proxy key DB** | Metered path is genuinely dead — must mint (see §2) |
| Proxy key loading | Proxy reads customer keys **per-request from SQLite, not cached at startup** | Inserting a new internal key needs **NO proxy restart** |
| TLS / DNS | Apex `luv13.com` TLS/SNI **fails**; `www` has **no DNS**; `api.luv13.com` valid but **routes to the API, not a dashboard** | No valid-cert home for the dashboard yet (see §5) |
| Stripe | **No** Stripe/payment integration exists | Build clean. (Proxy has its own cost/revenue bookkeeping — that's Neuralwatt-cost accounting, **not** customer billing; ignore for the wallet.) |

---

## §2. PATH-0 — final, unambiguous (stop-condition CLOSED)

Confirmed: the internal key is dead, and the proxy queries keys per-request (no startup cache). Fix, executed by **Hermes with Javier's approval** — this is the **only** proxy-DB write in scope:

1. On the proxy, **mint a fresh internal key using the existing key-generation script**. Do **not** hand-edit DB rows.
2. Set the new key as `upstream_api_key` in `/home/kor/luv13-api/config.json` (host file).
3. **`docker restart luv13-api`** — reloads `config.json` (read-only mount; **no rebuild**, since only config changed).
4. **No proxy restart required** (proxy reads keys per-request).
5. Verify: one real customer-key call through `api.luv13.com` returns a **200 completion**, no proxy 401.

Nothing else on the proxy. One INSERT via the script, one API restart.

---

## §3. Metering unit — confirmed float now; migrate the wallet to micro-dollars

Current metering writes float dollars to `requests.cost_usd REAL`. That column is **fine to keep for human-readable history/display** — but it must **never** be used for balance math (float money + the $0.33/M rounding-to-zero problem in Addendum §B).

**Final rule:**
- **Wallet source of truth = integer micro-dollars (µ$, 1e-6 USD).** Add `users.balance_umicro INTEGER NOT NULL DEFAULT 0`.
- **Rate as integer:** `RATE_UMICRO_PER_MILLION = 330000` (i.e. $0.33/M). Charge and reservation both use integer arithmetic:
  `charge_umicro = (total_tokens * 330000) // 1_000_000`
  (3,000 tokens → 990 µ$; 100 tokens → 33 µ$; never rounds a real request to zero.)
- Pick **one** rounding policy (floor is simplest and slightly customer-favorable) and apply it identically to reserve and settle so they can't disagree by a unit.
- Store the exact integer charge per request (`requests.charge_umicro INTEGER`) for reconciliation. Continue writing `cost_usd REAL` as a rounded **display mirror** only.
- **Stripe/top-ups stay in integer cents** (Stripe's unit); crediting the wallet converts `cents × 10_000 = µ$` (500 cents → 5,000,000 µ$).
- Display layer converts µ$ → `$X.XX` for UI only.

Addendum §B (unit) and §C (reservation/settlement/cut semantics) otherwise stand in full.

---

## §4. Model slug — confirmed `luv-1`; do NOT break the working client

- **`luv-1 → glm-5.2` is live and a client already uses it. Keep it permanently as an accepted alias.**
- **Add `luv13-glm-5.2 → glm-5.2`** as the new canonical customer slug. Docs, dashboard, examples, and the copy-paste curl all use **`luv13-glm-5.2`** going forward.
- **Both** slugs resolve to `glm-5.2`. The existing client keeps working unchanged.
- **Do not** surface or support the legacy prefixed slugs (`-fast`, `-kimi-code`, `-qwen3`, `-gemma-4-31b`) tonight — they belong to the legacy proxy, not the current customer path.

Closes Addendum §E ("verify the slug").

---

## §5. Dashboard host — ELEVATED to a hard requirement

Recon confirms there is **no valid-cert home for the web dashboard**: apex TLS fails, `www` has no DNS, and `api.luv13.com` serves the API. Tonight's customer journey (signup → top-up → keys → curl) requires the dashboard reachable over **valid HTTPS**.

**Fast path (recommended):** stand up **`app.luv13.com`** — add DNS + issue a cert, point it at the web app. The session cookie is `Domain=.luv13.com`, so auth and credentialed CORS already span it; no cookie changes needed.

- Treat **apex `luv13.com` TLS repair and `www` DNS as parallel / tomorrow-ok.** Do **not** let the apex block the journey.
- This is a **human/infra step** (DNS + cert issuance) — see prerequisites below. Without a valid-cert dashboard host, the production customer-journey DoD cannot be met tonight.

Supersedes Addendum §F: the "working subdomain" is now the **primary** plan, not a fallback.

---

## §6. Updated human prerequisites — clear BEFORE the autonomous run

- [ ] **Approve Hermes to execute the PATH-0 fix** (§2): one internal-key mint on the proxy via the script + set in `config.json` + restart API. No proxy restart. Nothing else on the proxy.
- [ ] **Stand up a valid-cert dashboard host** — `app.luv13.com` recommended: add DNS + issue cert (§5). Human/infra.
- [ ] **Register the Stripe webhook** in the Stripe dashboard → endpoint on the API host (e.g. `https://api.luv13.com/billing/webhook`); copy the **signing secret** into the API secret store. **Confirm Stripe is in LIVE mode** (live keys, not test). Cursor cannot do this dashboard step.
- [ ] **Prove the API DB backup is restorable** before any migration (`.backup` inside the container — WAL + root-owned dir).
- [ ] (`www` DNS and apex TLS may follow tomorrow — not gating.)

---

## Still useful but NOT blocking

- Full Hermes report text: I updated this from Javier's pasted summary; the linked report file is on the server and I can't open it. Paste its text if you want the exact `_stream_chat` relay edit pinned to current line numbers — otherwise Cursor/Hermes will see it in-situ.
