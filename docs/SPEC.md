# LUV13 — Technical Specification

**Project:** LUV13 public information page.  
**Product:** Host LLMs, starting with GLM-5.2. Communicate low costs and low prices.  
**Audience:** developers choosing providers, investors, curious visitors.

## Open Questions

- Founder email address for Resend notifications.
- Resend API key / custom domain for transaction email in production.
- Preferred host for deployment (default: Vercel).

## Scope (Must Have)

A single feed-style page at `/`.

1. **Header.** LUV13 logo (`BRAND_ASSETS/LUV13.png`), left-aligned. No navigation beyond the page itself.
2. **Hero.** Brand name, one-sentence thesis, and a single concrete price promise. Hero is a thesis: *We host GLM-5.2 for less.*
3. **What we do.** Plain statement of hosting LLMs with low prices because costs are low.
4. **Pricing.** Two line items only:
   - Input tokens: **$0.13 / 1M**
   - Output tokens: **$0.23 / 1M**
5. **API coming soon.** Email capture. Validates email, submits to `/api/notify`.
6. **Footer.** Minimal: © LUV13, maybe a contact/support link if available.

Technical surface:
- Next.js 16 App Router, React, TypeScript, Tailwind CSS v4.
- Static-rendered page. No client-side auth, no state persistence.
- `GET /api/health` returns `{ "status": "ok" }`.
- `POST /api/notify` validates email and sends it to founder via Resend. If Resend is not configured, log the attempt and return a graceful JSON response in development; production requires `RESEND_API_KEY` and `NOTIFY_EMAIL`.

### Design Requirements

- Pull visual source of truth from `BRAND_ASSETS/`:
  - Logo: `BRAND_ASSETS/LUV13.png`
  - Type/color reference: `BRAND_ASSETS/typography.png`
- Type: Helvetica Neue Bold. Fallback: Helvetica, Arial, sans-serif.
- Background: white (`#ffffff`).
- Text: `#0d0c12`.
- Primary button background: `#675c56`.
- Minimalist, spacious, Swiss-style layout. Let the type and price numbers carry the page.
- Mobile-first, responsive to desktop.
- Visible focus rings. Respect `prefers-reduced-motion`.

### Content Requirements

- Voice: "we". No founder biography. No personal story.
- Do not mention OpenRouter on the public site.
- No hype. Say what is, not what might be. Avoid "revolutionize", "AI-first", "cutting-edge".
- Use active voice. Headlines are statements.

## Out of Scope (Parking Lot)

- User accounts, authentication, dashboards.
- Real-time inference API, token streaming, billing, API keys.
- Model selection, comparisons, benchmarks, benchmarks/charts.
- Documentation, blog, testimonials, multi-page navigation.
- Dark mode.
- OpenRouter branding or partnership language.

## Architecture

```
Visitor
 │   GET /
 ▼
Next.js App Router
 │   renders
 ├─► page.tsx (Hero, Explanation, Pricing, Email form)
 ├─► layout.tsx (fonts, meta, brand colors)
 └─► public/BRAND_ASSETS/LUV13.png
 │
 │   POST /api/notify { email }
 ▼
notify/route.ts
 │   validates email
 ├─► Resend API  ──► founder inbox
 └─► fallback log (dev only)

/api/health  ──►  { status: "ok" }
```

### Data Flow

1. **Page load:** Server renders static HTML. Logo and CSS load. No runtime data fetching.
2. **Email capture:** Client sends JSON `POST /api/notify`. Server:
   - validates email shape,
   - guards against empty/bogus emails,
   - calls Resend if configured,
   - returns `{ ok: true }` on success, `{ error: "..." }` on failure.
3. **Health check:** Static endpoint for uptime verification.

## Security

- Keep `RESEND_API_KEY` server-side. Never expose it in client bundle.
- Validate and sanitize the email server-side. Reject malformed and empty inputs.
- Return generic success/error messages to avoid leaking configuration state.
- Limit `/api/notify` to reasonable request volume. A simple IP-aware or token-bucket rate limit is acceptable for v1.
- HTTPS only in production.
- No analytics scripts unless they are privacy-preserving and explicitly added later.

## Self-Sufficiency Requirements

Exposed by the build:
- `GET /api/health` returns 200.
- `npm run dev` starts cleanly.
- A `README.md` lists required environment variables and a one-command setup flow.
- Form submission failure shows a clear recovery message in the UI.

## Constraints & Decisions

- **Framework:** Next.js 16 with App Router. Rationale: easy static hosting, one API route, minimal boilerplate.
- **Styling:** Tailwind CSS v4 with CSS-first config. Rationale: one dependency, fast iteration, aligns with repo defaults.
- **Email service:** Resend. Rationale: low-volume, developer-friendly, cheap/free tier.
- **No database yet.** LUV13 does not need user data storage beyond the founder's inbox at this stage.
- **Deployment:** Dockerized on the founder's Debian mini PC. The site must build to a Docker image with a Node.js runtime, serve on an internal port (default 3000), and be reverse-proxied by the host. No Vercel-specific runtime APIs.
