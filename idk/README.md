# LUV13

Single-page information site for LUV13 — LLM hosting starting with GLM-5.2.

## Current Status

**Phases complete:** 0 (Bootstrap), 1 (Static Page Shell), 3 (Dockerize).

**Phase 2 (Email Capture) was skipped by request.** The `/api/notify` route exists in code but Resend/email capture is not enabled in the UI.

**What works right now:**
- `npm run dev` starts cleanly.
- `GET /api/health` returns `{ "status": "ok" }`.
- `/` renders the LUV13 landing page with logo, hero, and pricing.
- `npm run lint` and `npx tsc --noEmit` pass.
- `npm run build` produces a standalone production build.
- `node .next/standalone/server.js` serves the site correctly.

**Try it:**
```powershell
cd web; npm run dev
# then: open http://localhost:3000
```

**Deploy on the Debian mini PC:**
```bash
cd web
cp .env.example .env   # fill in RESEND_API_KEY, RESEND_FROM_EMAIL, NOTIFY_EMAIL
docker build -t luv13 .
docker run -d -p 3000:3000 --env-file .env --name luv13 luv13
```

## Docs

- [docs/SPEC.md](docs/SPEC.md) — what we're building.
- [docs/PLAN.md](docs/PLAN.md) — implementation order.
- [web/AGENTS.md](web/AGENTS.md) — how future agents should work here.
