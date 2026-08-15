# AGENTS.md — LUV13

**What this is:** The LUV13 marketing site plus production customer account UI. Email/password sessions, wallet balance, Stripe Checkout, recent usage, and API-key lifecycle are served by the FastAPI service at a configurable API base defaulting to `https://api.luv13.ai`.

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
│   │   ├── health/route.ts          # GET /api/health
│   │   ├── notify/route.ts          # POST /api/notify
│   ├── signup/page.tsx              # Email/password signup
│   ├── login/page.tsx               # Email/password login
│   ├── dashboard/page.tsx           # Authenticated customer dashboard
│   ├── keys/page.tsx                # Compatibility redirect
│   ├── top-up/page.tsx              # Dashboard modal redirect
│   ├── globals.css                  # Tailwind v4 + brand tokens
│   ├── layout.tsx                   # root layout, metadata, fonts, video bg
│   └── page.tsx                     # marketing home page
├── components/
│   ├── auth/                        # Signup/login UI
│   ├── dashboard/                   # Account dashboard UI
│   ├── notify-form.tsx              # email capture form
│   └── ui/                          # flow-button, liquid-glass, copy-field, etc.
├── lib/
│   └── api.ts                       # credentialed FastAPI client
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

| Command                                                                   | Use                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `npm install`                                                             | Install dependencies.                                   |
| `npm run dev`                                                             | Start dev server on `http://localhost:3000`.            |
| `npm run build`                                                           | Build for production.                                   |
| `npm start`                                                               | Start production server (after build or inside Docker). |
| `docker build -t luv13 .`                                                 | Build production Docker image.                          |
| `docker run -p 3000:3000 -e RESEND_API_KEY=... -e NOTIFY_EMAIL=... luv13` | Run container locally.                                  |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in for local development. Production values are injected at container runtime.

- `RESEND_API_KEY` — server-side Resend API key. Never expose to the client.
- `NOTIFY_EMAIL` — destination inbox for email-capture notifications.
- `NEXT_PUBLIC_LUV13_API_BASE` — customer API origin; defaults to `https://api.luv13.ai`.

## Framework Gotchas (CRITICAL)

- **Tailwind CSS v4** is CSS-first. Use `@import "tailwindcss";` and `@theme inline {}` in `globals.css`. Do NOT use the older `@tailwind base/components/utilities` directives.
- **Next.js 16 App Router API routes** live next to pages. A route is a directory with a `route.ts` file exporting HTTP handlers.
- **Customer calls are credentialed.** Route account calls through `lib/api.ts`; never omit `credentials: "include"`.
- **Full API keys are one-time secrets.** Hold a newly created secret only in transient component state; never log it or persist it in browser storage.
- **Docker uses standalone output.** `next.config.js` sets `output: 'standalone'` so the production image runs the Next.js server directly.
- **No internal provider or alias names on the public site.** Public examples use only the canonical LUV13 API URL and model slug.
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

1. Home → **START CREATING** → `/signup`
2. Signup/login → cookie-authenticated `/dashboard`
3. Create a named key at any balance → copy full secret once
4. Custom amount or preset → one `/billing/checkout` path → Stripe-hosted Checkout
5. Refresh `/dashboard` → session, wallet, recent usage, and masked keys reload from FastAPI

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
5. Run `npm test`; API account-scoping tests live under `../api/tests/`.

## Wrap-Up Protocol

Do not proceed to the next phase until the user confirms the current phase works. For each phase:

1. State clearly: "Let's wrap up Phase X."
2. Walk through exact manual test steps: "Open `/`, you should see Y."
3. Show command output for `npm run build`, `/api/health`, etc.
4. Update `README.md` current status.
5. Capture any new gotchas in this AGENTS.md file.
6. Ask the user whether to commit before continuing.

Never say "should work" or "probably works." Show that it works.
