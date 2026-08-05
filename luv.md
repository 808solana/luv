# LUV13: project research and build guide

## Executive summary

LUV13 is the public-facing foundation for a low-cost large-language-model (LLM) hosting service. Its launch offering is deliberately narrow: hosted **GLM-5.2** behind an OpenAI-compatible API shape, with the central commercial claim that lean, owned infrastructure permits lower token prices.

The website currently has two layers:

1. A highly visual marketing site at `/`, whose primary journey is **start creating → copy the API base URL → open the API-key area**.
2. A model directory at `/models`, currently populated from the documented launch catalog and equipped with client-side search, provider/capability filters, price/context formatting, and sorting.
3. A deliberately simulated API-access flow: balance, top-up, and API-key pages. These are functional UI/API prototypes but are **not yet a production account, billing, or credential system**.

The project is a Next.js 16 application in `web/`, written in TypeScript with React 19 and Tailwind CSS v4. It builds successfully as a standalone Node deployment suitable for the intended Docker deployment on a Debian mini PC.

## Product goal

The underlying product goal is simple rather than marketplace-like:

- Host one good model, GLM-5.2, rather than ask customers to choose or route among many models.
- Offer OpenAI-compatible chat-completions access, which lowers integration friction for existing AI tools and coding agents.
- Charge $0.13 per million input tokens and $0.23 per million output tokens.
- Keep the message focused on low operating costs translating into low customer prices.

The intended audiences are developers looking for a provider, investors, and curious visitors. Public copy uses a collective "we" voice, avoids founder biography and hype, and intentionally does not name the upstream-provider strategy described in private project notes.

## Current user experience

### Home page: `/`

The home page is a scroll-led brand experience rather than the original minimal one-page brief.

- A fixed HLS video (`https://video.korgems.com/stream/index.m3u8`) is used as the page background. As the visitor scrolls, the client code maps scroll progress to the video playhead.
- The first viewport is an intentionally empty full-screen visual opening, allowing the video to establish the brand treatment.
- The model section is now the functional model directory: visitors can search, filter, sort, and inspect the documented GLM-5.2 launch record in place of the earlier static feature-card presentation.
- The pricing section repeats the public price points.
- The API-access section lets a visitor submit an email to be notified when keys are live.
- The final primary content card says **START CREATING**, exposes `https://api.luv13.com/v1`, supports copying it to the clipboard, and links to `/keys`.

### Model directory: `/models`

The model directory is a compact, data-oriented catalog for the models LUV13 actually documents. Its first record is GLM-5.2, the launch model. It has no third-party logos or copied provider artwork: models receive compact generated initial marks until LUV13 has owned/provider-approved image assets.

- The toolbar searches model name, identifier, provider, description, and capability labels as the visitor types.
- The provider menu is generated from the current catalog.
- Reasoning, Vision, Tool use, and Flex are keyboard-accessible, multi-select filters. Multiple active capability filters use AND behavior: a result must support every selected capability.
- Sort options support popularity, release date, combined price, and context length. Records without the required data sort after those with it rather than being assigned invented values.
- Cards are separate, lightly bordered rectangles. They stack at phone widths and retain a horizontal information hierarchy at larger widths.
- Token pricing is unit-safe. Input and output prices are normalized to dollars per one million tokens and then added. GLM-5.2's published $0.13 input plus $0.23 output rate therefore renders as **$0.36 / 1M total tokens**.
- Missing context, price, popularity, or release data is shown as unavailable or sorted safely; the app does not manufacture metadata.
- The footer displays the LUV13 image logo and copyright.

The visual language is animated and glass-like: smooth scrolling, word/fade entrances, a text-scramble effect, blur/translucency, and pointer-driven holographic card tilt. Motion is substantially reduced for visitors who set `prefers-reduced-motion`.

### API-key prototype: `/keys`

This page represents the intended future self-service access flow.

- It fetches and displays a USD balance.
- A balance below $5.00 shows a Top up CTA.
- A balance at or above $5.00 permits a visitor to create a named API key.
- Newly created credentials expose the full secret only in the creation response; the later list shows a masked prefix and date.
- It also shows the claimed compatibility targets: Hermes, OpenCode, Cursor, and Kilo.

At the current implementation level, it is a local stub. There is no authentication, payment processor, database, usable inference gateway, or durable credential store.

### Top-up prototype: `/top-up` and `/top-up/success`

The top-up page offers $5, $10, $25, or custom amounts and lets visitors select Card, USDC, Apple Pay, Google Pay, or PayPal. Those selections are interface state only. Submitting calls the local stub endpoint, increments the in-memory balance, and redirects to a success page. The success page displays the amount and returns to `/keys` after three seconds unless reduced motion is requested.

## Mobile and desktop behavior

### One application, responsive presentation

There is **one LUV13 website**, not separate mobile and desktop applications. Every visitor receives the same Next.js routes, React component tree, client-side code, and API endpoints. The interface changes are mainly driven by Tailwind responsive utility classes in the same component files.

No server-side device detection, user-agent branching, mobile-only API, or device-specific dependency bundle is implemented. A phone and a desktop browser call the same `/api/balance`, `/api/keys`, `/api/top-up`, and `/api/notify` endpoints with the same request formats. Similarly, there is currently no login/authentication system, so there is no distinct logged-in mobile experience; the API-key screen is an unauthenticated prototype shared by everyone reaching it.

The code uses Tailwind's standard mobile-first breakpoints:

| Breakpoint | Starts at | How LUV13 uses it |
| --- | ---: | --- |
| Base | below 640px | Phone-first layout: compact spacing, single-column sections, wrapping controls, and stacked footer/navigation content. |
| `sm` | 640px | Small tablets/large phones: increases type where needed, puts simple rows side by side, and changes the footer to a horizontal row. |
| `md` | 768px | Tablet/desktop transition: substantially more outer padding, larger section spacing, two-column content cards, and horizontal key-creation controls. |
| `lg` | 1024px | Desktop: feature cards become a three-column, fixed-height grid; primary hero typography grows again. |
| `xl` | 1280px | Wide desktop: the Start Creating headline reaches its largest configured size. |

### Home page at phone sizes

The base styles are the phone layout, so the site remains usable without any breakpoint matching:

- Page sections use `px-6` horizontal padding and `py-20` vertical spacing rather than desktop's wider `md:px-12` / `md:py-28` treatment.
- The Start Creating glass card has reduced internal padding (`px-8 py-16`), and its heading starts at `text-3xl`.
- The feature section is one column. Each card naturally receives its own row and content can grow vertically.
- Pricing and notification content stack vertically. The two price figures remain a compact two-column group so both input and output prices are visible together.
- The footer stacks logo and copyright vertically; at `sm` and above, it changes to a left/right row.
- The fixed background video fills the screen using `object-cover`. A tall phone viewport therefore crops differently from a wide desktop viewport, but it uses the same HLS source; there is no mobile-specific video rendition configured in the source.
- The base URL copy surface is a horizontal flex row even on phone, with a smaller `text-sm` endpoint until `sm` raises it to `text-lg`. The endpoint itself is short enough to fit typical modern phone widths, but this is a component worth checking on very narrow devices and at large browser text sizes.

### Home page at tablet and desktop sizes

At `md` and above, the layout gains breathing room and begins using horizontal composition:

- The Start Creating glass panel expands from `px-8 py-16` to `md:px-16 md:py-24`; the type scales through `md`, `lg`, and `xl` sizes.
- The feature grid goes from one column to two columns at `md`, then to three columns at `lg`. At large desktop sizes, `lg:h-[480px]` makes the three feature cards share a consistent visual height.
- Both the pricing panel and notification panel switch from one column to a two-column grid at `md`, so product text and pricing/form sit alongside one another.
- The main layout containers are capped (`max-w-6xl` or `max-w-7xl`) and centered. As a result, content stops expanding indefinitely on ultra-wide monitors.
- The video remains fixed behind the whole marketing page rather than becoming a separate desktop treatment.

### API-key and top-up UI across devices

The prototype account flow is responsive in the same CSS-first way:

| Screen area | Phone/default behavior | Larger-screen behavior |
| --- | --- | --- |
| API shell | `px-4 py-10`, one centered card | `sm:px-6`, then taller `md:py-16` spacing; content stays intentionally narrow with `max-w-xl`. |
| Create-key form | Key label/input and Create button stack | At `sm`, they form a horizontal row and align to the input's bottom edge. |
| Existing key records | Name and metadata stack vertically | At `sm`, name sits beside masked key prefix/date. |
| Top-up amount choices | Buttons wrap as needed | They remain a flexible row; no separate desktop-only control exists. |
| Payment methods | Single-column selectable cards | Two-column grid at `sm`. |
| Quick-pay choices | Wrapping button row | Same pattern, with more available horizontal room. |
| Success view | Same content and balance re-fetch | Same content; the redirect rule is based on motion preference, not viewport width. |

All routes keep state behavior consistent across screen sizes. For example, a top-up affects the same process-local store whether submitted from phone or desktop. That is a prototype limitation rather than cross-device synchronization: a refresh, process restart, or separate deployed instance can discard state.

### Input and motion differences

The project also adapts to **how** a visitor interacts, not only screen width:

- `SmoothScroll` enables Lenis smooth wheel scrolling but has `syncTouch: false`; touch interactions use normal touch scrolling rather than attempting to mimic desktop wheel behavior.
- Holographic cards attach `mousemove` and `mouseleave` listeners. Desktop pointer users get 3D tilt and cursor-following glow. A touch-only phone user sees the same cards without those pointer effects.
- FlowButton's moving-arrow effect is driven by hover styles, so it reads primarily as a desktop pointer affordance; the button/link remains directly tappable on phone.
- Copy controls are native buttons on both devices. They use `navigator.clipboard` and fall back to a hidden-textarea copy technique when a browser does not permit the modern API.
- The video scrubber uses the same passive window scroll listener on every device. It continually maps document scroll position to the video playhead.
- Global CSS reduces animation and transition duration when `prefers-reduced-motion: reduce` is enabled. HolographicCard explicitly skips its pointer behavior under this setting, and the top-up success screen suppresses its auto-redirect. This is a user accessibility preference, not a mobile/desktop distinction.

### Device QA priorities before UI edits

Any future UI change should be checked at least at 375px, 640px, 768px, 1024px, and 1280px wide. The highest-risk parts are the fixed, scroll-scrubbed video on lower-powered phones; the endpoint copy row at very narrow widths; feature-card height/overflow as it changes from one to three columns; the stacked-to-inline API-key form; and custom text zoom, which can make a nominally mobile-sized viewport behave like a narrower one.

## Architecture

```text
Browser
  |
  +-- GET / ------------------> Next.js App Router marketing page
  |                              + client visual components
  |                              + remote HLS background video
  |
  +-- POST /api/notify -------> validates email
  |                              + Resend email, if configured
  |                              + otherwise logs and returns success
  |
  +-- GET /api/balance ------> module-scoped stub store
  +-- POST /api/top-up ------> module-scoped stub store
  +-- GET/POST /api/keys ----> module-scoped stub store
  |
  +-- GET /api/health -------> { "status": "ok" }
```

Next.js uses the App Router: pages live in `app/`, and server API handlers sit beside them in `app/api/**/route.ts`. The public pages are prerendered where possible; API handlers and the search-parameter-based top-up success page are rendered on demand.

## How the application is built

### Runtime and source stack

| Concern | Implementation |
| --- | --- |
| Framework | Next.js 16.2.9 App Router |
| UI runtime | React 19.2.4, TypeScript in strict mode |
| Styling | Tailwind CSS v4 with CSS-defined theme tokens |
| Motion | Framer Motion / Motion, GSAP ScrollTrigger, Lenis smooth scrolling |
| Media | Native HTML video plus `hls.js` when the browser needs HLS support |
| Icons | Lucide React |
| Email notifications | Resend, server-side only |
| Deployment target | Dockerized standalone Next.js/Node 22 service |

`web/next.config.ts` sets `output: "standalone"`. During production build, Next generates a self-contained server bundle. The multi-stage `web/Dockerfile` installs dependencies with `npm ci`, runs `npm run build`, then copies only the generated standalone server, static build files, and public assets into a Node 22 Alpine image. The container listens on port 3000 and runs `node server.js`.

### Styling and brand system

`web/app/globals.css` imports Tailwind and Astryx styling, then provides a 21st.dev/Vercel-derived OKLCH token system. The app bridges those CSS variables into Tailwind theme tokens. The final brand font stack is Helvetica Neue, Helvetica, Arial, then sans-serif; Instrument Serif is loaded from Google Fonts for italic display use.

The page body is transparent over a black HTML fallback, because the visual background is video rather than a solid page color. Glass utilities use CSS backdrop filtering and gradient-mask borders. There are light and `.dark` token definitions, but no visible dark-mode control or theme switching behavior.

### Motion and media implementation

- `SmoothScroll` creates a Lenis animation loop for wheel scrolling.
- `ScrollVideoBackground` dynamically imports `hls.js` if native HLS is unavailable, sets the highest HLS level after manifest parsing, tracks buffering, and sets `video.currentTime` from the document scroll position. It also blocks the viewport with a loading screen until the video can play.
- `WordsPullUp` and `FadeUp` provide viewport-triggered Framer Motion entrances.
- `SpecialText` performs the `START CREATING` character-scramble reveal.
- `HolographicCard` adds pointer-only 3D tilt and a cursor-following radial glow, opting out for reduced-motion users.
- `ScrollFloat` is an additional GSAP text animation component, but it is currently imported by the home page and not rendered.

## File-by-file map

### Repository and documentation

| File or directory | Contents and role |
| --- | --- |
| `README.md` | Root run/deploy quick start and previous phase status. |
| `PROJECT_CONTEXT.md` | Product context, architecture snapshot, deployment intent, and future parking lot. |
| `AGENT_MEMORY.md` | Working memory for contributors: decisions, brand constraints, video history, tooling notes, and known issues. It is useful context, not application runtime code. |
| `docs/SPEC.md` | Original product specification for a minimalist marketing page and email capture. |
| `docs/PLAN.md` | Original phased implementation plan. |
| `web/AGENTS.md` | Contributor instructions and a current codebase map; it acknowledges the API-key UI as a stub. |
| `web/README.md` | The uncustomized Create Next App README; it does not accurately describe this product. |

### Application routes

| File | What it contains |
| --- | --- |
| `web/app/layout.tsx` | Root metadata (`LUV13 — GLM-5.2 Hosting`), global CSS import, Instrument Serif preconnect/load hints, and site-wide Lenis component. |
| `web/app/page.tsx` | Home-page composition, public product claims, prices, email form placement, visual components, and remote HLS background mount. |
| `web/app/models/page.tsx` | Static `/models` route with a simple back-to-home header and the responsive client directory. |
| `web/app/keys/page.tsx` | Thin route wrapper around the API-key shell and interactive content. |
| `web/app/top-up/page.tsx` | Thin route wrapper around the top-up form. |
| `web/app/top-up/success/page.tsx` | Reads `amount` from the query string and renders the confirmation content. |
| `web/app/globals.css` | Tailwind/Astryx imports, CSS theme variables, font definitions, Lenis support, transparent video background behavior, glass utilities, and reduced-motion fallback. |

### Server endpoints

| Endpoint and file | Behavior |
| --- | --- |
| `GET /api/health` — `app/api/health/route.ts` | Returns `{ status: "ok" }`; suitable for basic container health checks. |
| `POST /api/notify` — `app/api/notify/route.ts` | Parses and validates an email, logs it, and sends a Resend message only when `RESEND_API_KEY` and `NOTIFY_EMAIL` are configured. `RESEND_FROM_EMAIL` is optional and defaults to Resend's onboarding sender. |
| `GET /api/balance` — `app/api/balance/route.ts` | Returns the stub balance, currency, and $5.00 minimum key-creation balance. |
| `GET /api/keys` — `app/api/keys/route.ts` | Lists only safe key metadata: id, name, masked prefix, and created date. |
| `POST /api/keys` — `app/api/keys/route.ts` | Requires a non-empty name and returns the new full key once. |
| `POST /api/top-up` — `app/api/top-up/route.ts` | Validates a positive integer cent amount and increments the stub balance. It does not contact a payment provider. |

### Components

| Area | Files and responsibility |
| --- | --- |
| Marketing animations | `words-pull-up.tsx`, `scroll-float.tsx`, `special-text.tsx`, `holographic-card.tsx`. |
| Marketing media | `scroll-video-background.tsx` handles HLS/native media and scroll seeking; `hosting-image.tsx` places the API-preview image in Astryx's aspect-ratio wrapper. |
| Lead capture | `notify-form.tsx` validates client-side, sends JSON to `/api/notify`, and shows loading/success/error state. Server validation remains the authority. |
| Navigation/actions | `ui/flow-button.tsx` is the animated pill CTA; `ui/button.tsx` is a variant-based Radix Slot button primitive. |
| Copying | `ui/base-url-display.tsx` and `ui/copy-field.tsx` copy text with the Clipboard API and a legacy textarea fallback. |
| Visual surface | `ui/liquid-glass.tsx` creates the larger SVG-filter glass effect used by the primary home card. |
| API-key UI | `components/api/*` load balance and keys in the browser, gate key creation on the $5 balance, create/copy a key, provide the top-up selector, and display success state. |
| Model directory UI | `components/models/*` provides the reusable toolbar, model card, capability badge, combined-price display, context display, and empty state. |
| Model directory data/logic | `lib/models.ts` contains the documented launch catalog; `lib/model-directory.ts` owns unit-normalized pricing, context formatting, filtering, and sorting. |
| Shared utility | `lib/utils.ts` combines `clsx` and `tailwind-merge` as `cn()`. |

### State model

`web/lib/stub-store.ts` is the most important boundary between prototype and production. It stores an initial $0 balance and a `Map` of API-key records in module scope.

- Data is shared only while a particular Node process remains alive.
- It is lost on restart, rebuild, or deployment replacement.
- It is not tied to a signed-in user, so it cannot safely represent real customer balances or keys.
- Keys are represented as `luv_` plus generated suffixes. The key list correctly withholds the full secret after creation, but the suffix generator uses `Math.random()` and is not appropriate for real credentials.

## Assets

Public assets are under `web/public/` and are served at the same paths without `public` in the URL.

| Asset | Purpose |
| --- | --- |
| `public/BRAND_ASSETS/LUV13.png` | Main logo used in the footer. |
| `public/BRAND_ASSETS/typography.png` | Brand/type reference image. |
| `public/BRAND_ASSETS/HelveticaNeue-Bold.otf` | Brand font asset retained in the repository. Current CSS declares local Helvetica Neue names rather than loading this file by URL. |
| `public/hosting-model-v2.png` | API/model preview currently used on the home page. |
| `public/hosting-model.png` | Earlier/duplicate preview image; it is not currently imported. |
| `public/{next,vercel,globe,file,window}.svg` | Standard scaffold assets; none are referenced by the current page source. |
| `app/icon.png`, `app/luvlogo2.png`, `app/cents.png` | App-local image assets. The route tree exposes `icon.png` as the site icon; the latter two are not imported by the current TypeScript source. |

## Development and operations

Run commands from `web/`:

```powershell
npm install
npm run dev
npm run lint
npm run build
npm start
```

The development site is normally available at `http://localhost:3000`; health is `http://localhost:3000/api/health`.

For production packaging:

```bash
cd web
docker build -t luv13 .
docker run -d -p 3000:3000 --env-file .env --name luv13 luv13
```

Email notification configuration is server-side:

```text
RESEND_API_KEY=...
NOTIFY_EMAIL=...
RESEND_FROM_EMAIL=...   # optional; defaults to onboarding@resend.dev
```

The current root README and contributor guide refer to an `.env.example`, but no such file is currently present in `web/`. Create the runtime environment file manually and do not commit it; `.gitignore` excludes `.env*` files.

## Verification performed for this review

On August 4, 2026, I ran `npx tsc --noEmit` and `npm run build` from `web/`. Both completed successfully using Next.js 16.2.9/Turbopack. The build produced the expected public pages (`/`, `/models`, `/keys`, `/top-up`) plus the dynamic API routes and the top-up success route. `npm run lint` currently fails on five pre-existing `react-hooks/set-state-in-effect` errors in API-key and text-animation components; the model-directory files introduce no lint errors.

## Current-state gaps and documentation drift

The project is sound as a front-end/service prototype, but the following distinctions matter before it is described as a live hosting product:

1. **The written spec and current site differ.** `docs/SPEC.md` describes a minimal, white, single-page site with no key/billing system and says API access is coming soon. The live source has a video-driven, glass-heavy design and a fully navigable *stub* keys/top-up flow.
2. **There is no actual inference proxy.** The UI advertises `https://api.luv13.com/v1` and compatibility, but this repository implements no `/v1/chat/completions`, upstream model connection, token metering, streaming proxy, or model gateway.
3. **There is no production identity, billing, or storage layer.** A real rollout needs authentication/tenant ownership, a database, payment-provider verification/webhooks, durable encrypted credential storage, revocation, usage accounting, rate limits, and quotas.
4. **Email capture is permissive in the current code.** Without configured Resend credentials and a target email, it logs the address and returns success. The endpoint validates shape but does not currently implement the rate limiting suggested by the specification.
5. **The visual-video implementation differs from some contributor notes.** The live source mounts the video from `page.tsx` and uses `object-cover`; earlier memory notes describe it as layout-mounted with `object-contain`. The source is the reliable representation of current behavior.
6. **Some documentation is stale.** `web/README.md` is default scaffold text, and root deployment examples refer to an absent `.env.example`.
7. **Unrelated working-tree changes existed during this review.** `gotthembands.txt` was already deleted and `web/package-lock.json` already modified. They were not changed as part of creating this document.

## Recommended next milestones

1. Decide whether the public site should keep the API-key prototype visible before real API access exists. If yes, label every payment/key interaction unmistakably as demo or preview.
2. Implement the actual model gateway and define the source of truth for model availability, pricing, token accounting, and streaming behavior.
3. Replace `stub-store.ts` with authenticated, durable, tenant-scoped storage; use cryptographically secure secrets and store only protected representations of API keys.
4. Integrate a payment provider with verified server-side webhooks before crediting balance.
5. Add usage reporting, balance enforcement at the gateway, key revocation, rate limiting, and audit logs.
6. Reconcile `docs/SPEC.md`, `docs/PLAN.md`, both READMEs, and the actual visual/video decisions so a future contributor has one reliable current specification.
