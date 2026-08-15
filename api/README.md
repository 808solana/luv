# luv13-api

Metered OpenAI-compatible passthrough: `client → api.luv13.ai/v1 → neuralwatt-proxy (:4000) → Neuralwatt`.

Runtime config lives in the untracked `config.json`; copy the sanitized
`config.example.json` and inject real secrets only on the target host. Never
commit live config, environment files, or SQLite data.

## Run

```bash
docker compose up -d --build
```

Runs on port **4100**. SQLite database lands in `./data/luv13.db` (created automatically).

## Config (`config.json`)

| Field | Meaning |
|---|---|
| `admin_secret` | Shared secret the website sends as `X-Admin-Secret` header |
| `upstream_root` | Root URL where requests are forwarded to the neuralwatt proxy |
| `upstream_api_key` | Optional Bearer key for upstream (empty = none) |
| `models` | Public model IDs mapped to `upstream` and integer `rate_umicro_per_million` |
| `output_floor_tokens` | Minimum affordable output allowance for a best-effort low-balance reservation |
| `rate_limit_per_key_per_minute` | Per-key sliding window; 0 disables |
| `monthly_token_cap_per_user` | Hard monthly cap per account; 0 = unlimited |

Config is volume-mounted read-only, so edits only need `docker compose restart`.
Runtime secrets and browser settings (`JWT_SECRET`, cookie/frontend origins,
Google OAuth, Stripe keys/webhook secret, Checkout URLs, top-up maximum, and
trusted proxy IPs) come from the untracked `.env`; see `.env.example`.

## User-facing API (key auth: `Authorization: Bearer REDACTED_PLACEHOLDER`)

```bash
curl https://api.luv13.ai/v1/chat/completions \
  -H "Authorization: Bearer REDACTED_PLACEHOLDER" \
  -H "Content-Type: application/json" \
  -d '{"model": "luv13-glm-5.2", "messages": [{"role": "user", "content": "hi"}]}'
```

- `POST /v1/chat/completions` — streaming and non-streaming; usage metered either way
- `GET /v1/models` — lists luv13 model names
- `GET /health` — no auth

`luv13-glm-5.2` is the canonical GLM customer ID. `luv-1` remains accepted for
existing clients. Legacy suffixed proxy slugs are not exposed or supported by
this API path.

Wallet accounting uses integer micro-dollars (`balance_umicro` and
`charge_umicro`). Stripe top-ups remain integer cents and convert exactly at
`cents * 10_000`; `requests.cost_usd` is display history only.

Before upstream work, the API atomically reserves estimated input plus an
8,000-token output budget. Low balances receive a smaller affordable output
cap only when they can cover estimated input plus `output_floor_tokens`;
otherwise the API returns 402 without contacting upstream. Settlement and
refund happen once in the same SQLite transaction as the usage row.

## Billing

- `POST /billing/checkout` — cookie-authenticated; accepts integer
  `amount_cents` from 500 through `STRIPE_MAX_TOPUP_CENTS` and returns a Stripe
  Checkout URL. Exact decimal `amount_usd` remains accepted for compatibility.
- `POST /billing/webhook` — raw-body Stripe signature verification; only a
  matching paid `checkout.session.completed` event can credit a pending top-up.
- `GET /billing/balance` and `GET /billing/topups` — cookie-scoped wallet and
  top-up history reads.

Checkout creation and browser redirects never credit balances. The webhook
transaction validates persisted amount, user, session, payment-intent, and
customer bindings before applying `amount_cents * 10_000` exactly once.

Works with any OpenAI SDK: set `base_url="https://api.luv13.ai/v1"` and the key.

## Admin API (website → backend, header: `X-Admin-Secret: <admin_secret>`)

| Endpoint | Purpose |
|---|---|
| `POST /internal/keys` `{"email": "...", "name": "..."}` | Create key. **Full key returned only here** (only a hash is stored) |
| `GET /internal/keys?email=...` | List a user's keys (prefix, name, created, revoked, last used) |
| `POST /internal/keys/{id}/revoke` | Revoke a key |
| `GET /internal/usage?email=...&limit=100&offset=0` | Per-request log: ts, model, tokens in/out/cached, cost, status, latency |
| `GET /internal/summary?email=...` | Totals: requests, tokens in/out/cached, total tokens, total cost |
| `GET /internal/users` | All users with lifetime totals |

Website integration example (Node):

```js
const API = "http://API_HOST:4100"; // same-box; or https://api.luv13.ai if routed
const headers = { "X-Admin-Secret": ADMIN_SECRET, "Content-Type": "application/json" };

// "Create New API" button:
const r = await fetch(`${API}/internal/keys`, {
  method: "POST", headers,
  body: JSON.stringify({ email: user.email, name: "My key" }),
});
const { key } = await r.json(); // show once to the user

// Usage dashboard:
const usage = await (await fetch(`${API}/internal/usage?email=${user.email}`, { headers })).json();
const totals = await (await fetch(`${API}/internal/summary?email=${user.email}`, { headers })).json();
```
