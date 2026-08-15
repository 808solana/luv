# Production source import — 2026-08-13

## Provenance

- API source: `/home/kor/luv13-api`, clean Git commit
  `aeac7aad6098cb4200eb05071ef39d50c40a93a0` (tree
  `a8fdd960e85eabb8b75b2a0ba10ad95df957891c`).
- API container image:
  `sha256:2096f9d20584a1fef1d54705334e3659ab048fa4d61aaa2e646f01901883c11b`.
  Every `/home/kor/luv13-api/app/*.py` hash matched the corresponding
  `/app/app/*.py` file in the running `luv13-api` container.
- Proxy source: `/home/kor/neuralwatt-proxy`, based on commit
  `c38e8bb61edc0a529664325706ba96c4f95c4182` (tree
  `045b5a8acf69a8e46917b7415961527c1c11e91a`) with tracked dirty patch SHA-256
  `e8024dba7d78a75efa5481ecff51ce2bf61e233290c88e35e2d3e912ec1cfafb`.
- Proxy container image:
  `sha256:925d9d2b8c766628363aba08c5714ac38635a08762f10ef00aa2604e235e5206`.
  Host and running-container `proxy.py` both hashed to
  `a83d28be83e738d81199601ccd31ad3fd2924be9c7f460e3536737555d3d1f7b`.
- The imported proxy contains placeholders in place of ten hardcoded upstream
  keys. Its SHA-256
  (`b2ac2000f72b6dd3268c6cd513fa736f90afff53727a46dbd4e250f3d1223852`)
  exactly matches the deployed file after applying the same deterministic
  redaction.

Production was inspected read-only. No service, file, database, or container
was changed.

## Sanitization boundary

The import excluded live `.env` files, `config.json`, databases and WAL/SHM
files, customer/runtime data, logs, caches, virtual environments,
`node_modules`, build output, keys/certificates, backups, rollback files,
captures, result JSON, and read-only generated reports. Git metadata was not
nested into this repository.

Token-shaped literals and credential assignments were replaced in transit,
before they reached the local filesystem. API configuration is represented by
`.env.example` and `config.example.json`; the proxy's existing `.env.example`
contains placeholders only. The proxy cannot contact its real upstream from
this sanitized checkout because its deployed upstream credentials are
intentionally not present.

## Code map

### API (`api/`)

- Auth and cookies: `app/auth.py`. Passwords use bcrypt; HS256 session JWTs are
  revocable through hashed rows in `sessions`. The session and OAuth-state
  cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, and domain-configurable.
- Browser CORS: `app/main.py` uses explicit `FRONTEND_ORIGINS` with credentials.
- Routing: auth and `/api/keys` routes are registered before the catch-all.
  Unknown routes and legacy keys pass through to the proxy.
- Key generation: `app/db.py:create_key` creates `sk-luv13-` plus 24 random hex
  bytes, stores only SHA-256 and a prefix, and returns plaintext once.
- Model map and metering: `app/config.py` loads the public-to-upstream map and a
  single float rate. `app/main.py` rewrites the model and records final usage in
  `requests`.
- Streaming: `app/main.py:_stream_chat` reads upstream SSE line-by-line,
  captures the final usage object, rewrites the response model, and logs usage
  in `finally`. It currently has no wallet reservation or mid-stream credit
  enforcement.
- Migrations and usage: `app/db.py:migrate` idempotently adds auth columns and
  creates session/login tables. Usage summaries and logs read `requests`.
- Health: `GET /health`.
- Packaging: Python 3.12 slim + Uvicorn. Compose bind-mounts `data/` and
  read-only `config.json`, and loads secrets from `.env`.

### Proxy (`proxy/`)

- Auth and routing: `proxy.py` hashes branded keys from SQLite; admin access is
  constant-time token/cookie auth. `/v1/chat/completions` maps model slugs and
  dispatches across the account pool.
- Key generation: `/keys/generate` verifies a JWT email, creates a random
  32-character `sk-luv13-` key, stores only its hash/prefix, and assigns the
  least-used upstream account index.
- Model map: `MODEL_MAP` includes branded and bare GLM, Kimi, Qwen, and Gemma
  aliases.
- Metering and usage: `record_usage` writes input/output/cached counts, upstream
  cost, customer revenue, and actual serving account. `/usage` is scoped to the
  authenticated key.
- Streaming: `stream_upstream` and the chat response generator preserve raw
  chunks by default, add heartbeats, retry stalls/overload, record terminal
  outcomes, and optionally sanitize SSE. Tool-call deltas count as substantive
  and are not removed.
- Migrations: `init_db` creates users/customers/keys/usage/events/outcomes and
  idempotently adds `usage.served_upstream_index`.
- CORS and health: wildcard non-credentialed CORS; `GET /health`.
- Packaging: Python 3.11 slim + one Gunicorn gevent worker. Compose mounts
  `data/` and diagnostic captures; capture is enabled by its current default.

## Phase 1 blockers and follow-ups

- The sanitized proxy is intentionally non-runnable against Neuralwatt until
  upstream credentials are supplied through an approved secret mechanism.
- Canonical API defaults are `luv13.ai` / `api.luv13.ai` (cookie `.luv13.ai`,
  CORS `https://luv13.ai`). Legacy `api.luv13.com` remains an operational
  hostname. `luv.ai` is not a live origin.
- API `Dockerfile` copies `config.json`; a local image build therefore requires
  a deliberately created, ignored runtime config. No live config was copied.
- The API stream relay is line-oriented and swallows parse errors. Preserve
  `tool_calls` framing when later adding wallet enforcement.
