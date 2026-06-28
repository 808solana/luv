# LUV13 — Implementation Plan

Spec reference: `docs/SPEC.md`

## Open Questions

- From email address and domain for Resend (`from@luv13.example`).
- Destination email address for notifications.
- Host port on the Debian mini PC (default: map container `3000` to host `3000`).
- Whether reverse proxy / HTTPS is handled outside the container (assumed yes, out of scope).

## Tasks

### Phase 0: Bootstrap
☐ Create `web/` directory and scaffold Next.js 16 App Router + TypeScript + Tailwind CSS v4.  
☐ Install runtime dependency `resend`.  
☐ Copy `BRAND_ASSETS/LUV13.png` into `web/public/BRAND_ASSETS/`.  
☐ Add root `README.md` with setup, env vars, and run commands.  
☐ Add `.dockerignore` and a multi-stage `web/Dockerfile`.  
☐ Run dev server and confirm `/api/health` returns `{ "status": "ok" }`.

### Phase 1: Static Page Shell
☐ Configure global styles in `web/app/globals.css` with Tailwind v4 theme tokens: white background, text `#0d0c12`, button `#675c56`, font stack `'Helvetica Neue', Helvetica, Arial, sans-serif`.  
☐ Create `web/app/layout.tsx` with page metadata and font loading.  
☐ Create `web/app/page.tsx` with sections: header/logo, hero, explanation, pricing ($0.13 / $0.23).  
☐ Add `web/app/api/health/route.ts` returning `{ status: "ok" }`.  
☐ Verify page renders and matches brand colors/logo in browser.

### Phase 2: Email Capture
☐ Create `web/app/api/notify/route.ts`: validate email, send via Resend when configured, return JSON.  
☐ Add `.env.example` with `RESEND_API_KEY` and `NOTIFY_EMAIL`.  
☐ Build email form component with validation, loading state, success/error messages, and accessible labels.  
☐ Add the form to the page under an "API coming soon" section.  
☐ Test: submit a valid email and confirm server logs success or actual email arrives if Resend is configured.

### Phase 3: Dockerize
☐ Configure Next.js standalone output for `web/next.config.js`.  
☐ Build Docker image and run container on the mini PC (or locally).  
☐ Verify container serves `/` and `/api/health` responds.  
☐ Document run command / compose snippet in `README.md`.

### Phase 4: Polish & QA
☐ Check responsive layout at 375px, 768px, and 1280px.  
☐ Verify keyboard navigation, focus rings, and alt text on the logo.  
☐ Confirm `prefers-reduced-motion` disables non-essential motion.  
☐ Run a final dev build (`next build`) with no errors.

## Phase Details

### Phase 0: Bootstrap

**Affected Files:**
- `web/` (new directory) — entire Next.js application.
- `web/public/BRAND_ASSETS/LUV13.png` (new) — logo served as static asset.
- `web/Dockerfile` (new) — production Docker image.
- `web/.dockerignore` (new) — exclude node_modules and local env.
- `README.md` (new) — setup, env vars, dev/build/run instructions.

**Goal:** Establish a runnable foundation.

**Done means:** `npm run dev` inside `web/` starts without errors and `GET http://localhost:3000/api/health` returns 200.

**Test it:**
1. `cd web && npm run dev`
2. `curl http://localhost:3000/api/health`
3. Expected output: `{ "status": "ok" }`

### Phase 1: Static Page Shell

**Affected Files:**
- `web/app/globals.css` (new) — Tailwind v4 import and theme tokens.
- `web/app/layout.tsx` (new) — root layout, metadata, font stack.
- `web/app/page.tsx` (new) — feed page with header, hero, explanation, pricing.
- `web/app/api/health/route.ts` (new) — health endpoint.

**Goal:** Build the visible page that communicates who LUV13 is.

**Done means:** Opening `/` shows the LUV13 logo, headline, explanation, and pricing with correct colors and typography.

**Test it:**
1. Refresh `/` at desktop width.
2. Confirm logo is crisp and alt text exists.
3. Confirm no horizontal scroll and text color is `#0d0c12`.

### Phase 2: Email Capture

**Affected Files:**
- `web/app/api/notify/route.ts` (new) — email validation and Resend integration.
- `web/.env.example` (new) — documented environment variables.
- `web/app/page.tsx` (modify) — add email form section.
- `web/components/notify-form.tsx` (new) — email form component.

**Goal:** Let visitors leave an email for API-key notifications.

**Done means:** Submitting a valid email shows a clear success message; invalid emails show a helpful error; the server returns JSON without leaking config.

**Test it:**
1. Submit `not-an-email` — expect inline error.
2. Submit a valid email — expect success message.
3. Check terminal/logs for the email payload when Resend is not configured.
4. If Resend is configured, confirm the destination inbox receives the email.

### Phase 3: Dockerize

**Affected Files:**
- `web/next.config.js` (new/modify) — `output: 'standalone'`.
- `web/Dockerfile` (modify if needed) — ensure standalone server starts.
- `README.md` (modify) — add Docker build/run instructions.

**Goal:** Package the site for the Debian mini PC.

**Done means:** `docker run` exposes the site and health endpoint responds.

**Test it:**
1. `cd web && docker build -t luv13 .`
2. `docker run -p 3000:3000 -e RESEND_API_KEY=... -e NOTIFY_EMAIL=... luv13`
3. `curl http://localhost:3000/api/health` returns 200.

### Phase 4: Polish & QA

**Affected Files:**
- Any CSS/component files needing responsive or accessibility fixes.

**Goal:** Leave the page clean, accessible, and production-ready.

**Done means:** All checklist items in the Phase 4 task list pass manual inspection.

**Test it:**
1. Resize browser to 375px, 768px, 1280px; verify no broken layouts.
2. Tab through the page; confirm focus rings are visible and order is logical.
3. Enable prefers-reduced-motion; confirm animations reduce.
4. Run `npm run build` and expect a successful exit code.
