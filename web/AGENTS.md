# AGENTS.md — LUV13

**What this is:** A marketing site plus stub API-key UI for LUV13, an LLM hosting provider launching with GLM-5.2. The home page states the value proposition (low costs → low prices) and captures emails. The `/keys` section lets users top up a mock balance and create API keys (server-side stub; no real payments yet).

**Working directory:** `c:\Users\jgran\luv\web`

**Source of truth for requirements:**
1. [`../docs/SPEC.md`](../docs/SPEC.md) — what to build and why.
2. [`../docs/PLAN.md`](../docs/PLAN.md) — implementation order.
3. [`../BRAND_ASSETS/`](../BRAND_ASSETS/) — logo and typography reference.

## Codebase Map

```
web/
├── app/
│   ├── api/
│   │   ├── balance/route.ts         # GET /api/balance
│   │   ├── health/route.ts          # GET /api/health
│   │   ├── keys/route.ts            # GET + POST /api/keys
│   │   ├── notify/route.ts          # POST /api/notify
│   │   └── top-up/route.ts          # POST /api/top-up
│   ├── keys/page.tsx                # API key management UI
│   ├── top-up/page.tsx              # Top-up form
│   ├── top-up/success/page.tsx      # Post top-up confirmation
│   ├── globals.css                  # Tailwind v4 + brand tokens
│   ├── layout.tsx                   # root layout, metadata, fonts, video bg
│   └── page.tsx                     # marketing home page
├── components/
│   ├── api/                         # API section UI (shell, balance, keys, top-up)
│   ├── notify-form.tsx              # email capture form
│   └── ui/                          # flow-button, liquid-glass, copy-field, etc.
├── lib/
│   └── stub-store.ts                # in-memory balance + keys (dev/stub only)
├── public/
│   └── BRAND_ASSETS/
│       └── LUV13.png                # logo asset
├── .env.example                     # required env vars
├── .dockerignore
├── Dockerfile                       # production Docker image
├── next.config.js                   # standalone output
├── package.json
└── README.md
```

## Commands

Run from `web/`:

| Command | Use |
|---|---|
| `npm install` | Install dependencies. |
| `npm run dev` | Start dev server on `http://localhost:3000`. |
| `npm run build` | Build for production. |
| `npm start` | Start production server (after build or inside Docker). |
| `docker build -t luv13 .` | Build production Docker image. |
| `docker run -p 3000:3000 -e RESEND_API_KEY=... -e NOTIFY_EMAIL=... luv13` | Run container locally. |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in for local development. Production values are injected at container runtime.

- `RESEND_API_KEY` — server-side Resend API key. Never expose to the client.
- `NOTIFY_EMAIL` — destination inbox for email-capture notifications.

## Framework Gotchas (CRITICAL)

- **Tailwind CSS v4** is CSS-first. Use `@import "tailwindcss";` and `@theme inline {}` in `globals.css`. Do NOT use the older `@tailwind base/components/utilities` directives.
- **Next.js 16 App Router API routes** live next to pages. A route is a directory with a `route.ts` file exporting HTTP handlers.
- **API keys stay server-side.** `RESEND_API_KEY` and `NOTIFY_EMAIL` are only read inside API routes. Stub keys in `stub-store.ts` are in-memory only — lost on server restart.
- **Docker uses standalone output.** `next.config.js` sets `output: 'standalone'` so the production image runs the Next.js server directly.
- **No OpenRouter on the public site.** It is fine as an upstream provider in the future, but do not mention it in copy, URLs, or comments visible to users.
- **Windows `.next` lock:** If `npm run build` fails with `EBUSY: resource busy or locked, rmdir '.next/standalone'`, a Node process is holding the directory. Stop all `node.exe` processes and retry.
- **Windows PowerShell:** Do not chain with `&&`; use `;` or separate commands. A dev server already on port 3000 hot-reloads — do not start a second one.

## Brand Constraints

- Logo: `public/BRAND_ASSETS/LUV13.png`.
- Typography: `Helvetica Neue`, fall back to `Helvetica`, `Arial`, sans-serif. Use bold weight for headings/buttons.
- Colors:
  - Background: white `#ffffff`.
  - Text: `#0d0c12`.
  - Button background: `#675c56`.
- Voice: "we". No founder biography. Simple, direct, no hype.

## API Section User Flow

1. Home → "Api Key" CTA → `/keys`
2. Balance &lt; $5.00 → "Top up" → `/top-up` → mock payment → `/top-up/success` → auto-redirect `/keys`
3. Balance ≥ $5.00 → create named key → copy base URL + full secret once
4. Refresh `/keys` → key list shows masked prefix only

## Continuous Documentation

Update docs immediately when implementation diverges from the spec or plan:

- `../docs/SPEC.md` — architectural or scope changes.
- `../docs/PLAN.md` — changes to "Done means" or test steps.
- `README.md` — current status and how to run.

## Verification

Before calling a phase complete, show evidence:

1. Run `npm run build` and confirm exit code 0.
2. Run `npm run dev` and verify `/api/health` returns `200 { "status": "ok" }`.
3. Verify the page visually at 375px, 768px, and 1280px.
4. Confirm keyboard navigation and focus rings work.
5. Stub API smoke test: `GET /api/balance`, `POST /api/top-up`, `POST /api/keys`, `GET /api/keys`.

## Wrap-Up Protocol

Do not proceed to the next phase until the user confirms the current phase works. For each phase:

1. State clearly: "Let's wrap up Phase X."
2. Walk through exact manual test steps: "Open `/`, you should see Y."
3. Show command output for `npm run build`, `/api/health`, etc.
4. Update `README.md` current status.
5. Capture any new gotchas in this AGENTS.md file.
6. Ask the user whether to commit before continuing.

Never say "should work" or "probably works." Show that it works.
