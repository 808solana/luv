# Agent Memory
read @soul.md always first 

## Environment

always read !
- Repo root: `/Users/real/luv`
- Web app: `web/` (Next.js App Router, Tailwind v4)
- Package manager: npm (run from `web/`)
- UI local server is `web/` (`npm run dev` → `http://localhost:3000`), not the FastAPI process on `:4100`. User calls this folder “lev-web” / the current local UI.

## Production (Kor)

- Production SSH host alias: `kor` (`~/.ssh/config`). User `kor`. Tailscale hostname `100.90.62.96` (preferred). Public IP `71.209.202.110`. OS: Debian 13 (trixie) — “DBN” in speech. Identity: `~/.ssh/id_ed25519_homelab`. Briefing: `idk/kor.md` (contains credentials — never paste).
- There is **no** Docker container named `luv13` or `lub13`. Live site container is **`luv13-web`** (`3100→3000`). API `luv13-api` (`4100`). Proxy `luv13-proxy` (`4000`) — do not rebuild unless asked.
- Host paths: live web `/home/kor/luv13-web`, live API `/home/kor/luv13-api`, proxy `/home/kor/neuralwatt-proxy`, full working-tree dump `/home/kor/luv`.
- Web deploy: tar-over-ssh (set `COPYFILE_DISABLE=1`). Preserve remote `/home/kor/luv13-web/.env.production` and `docker-compose.yml`. Then `cd /home/kor/luv13-web && docker compose up -d --build`. Do not bind LUV13 web to host `:3000`.
- Do not overwrite live API `.env`, `config.json`, `data/`, or `app/billing.py` (remote is ahead: Stripe `managed_payments`). Do not rsync local `proxy/` onto live proxy.
- Skill: `.cursor/skills/tooling/luv13-production-deploy.md`.

## Preferences
- No reload/splash overlay — page loads bare
- Marketing chrome: always-on **transparent** sticky header (no white slab, no logo). Single **Dashboard** link (`/keys` → dashboard) on desktop **and** mobile — no Models link, no hamburger/mobile menu. Sparse footer + LEV 13 © 2026. Nav links/bars are plain ink **without** text-shadow — white offset shadows discolor over colored sections.

## Brand
- Browser tab title: `luv13` (lowercase, no suffix)
- Logo path: `/BRAND_ASSETS/LUV13.png` (black mark, light edge outlines)
- Site typeface (permanent): `web/public/BRAND_ASSETS/HelveticaNeue-Bold.ttf` as `HelveticaNeue-Bold` for UI. `HelveticaNeueUltraLightItalic.otf` only for designated subtext (`#models` heading “Infrastructure by Neuralwatt.com”, `#use-now` credit “facts by openrouter.com”, `#models` chart credit “facts by artificialanalysis.ai”). Do not load Instrument Serif / General Sans. `font-mono` only for keys, URLs, model IDs.

## Home UX
- `/` hero is ungated: land already in, no enter pill. Compact (not full-viewport) `luv13` mark only on a solid brand-red (`#fe0000`) field — white `--paper` mark, then a white gap before Neuralwatt. Catalog is visible on first paint. No wash/overlay, no `.ai` suffix, no period, no `HomeScrollFx`.
- Marketing header is a fixed transparent nav over the hero. Desktop and mobile: a single **Dashboard** link (`/keys`) only. No header logo, no Models, no hamburger.
- Home `#models` heading is **Infrastructure by Neuralwatt.com** (HelveticaNeueUltraLightItalic, `.hero-neuralwatt`). Not a hero subline. Section sits ~350px below the mark. Compact stacked list: small **unframed** mark, name beside it, Context (**1 million**) / **Price: $x Per Million Tokens** / ID under. Right of the list from `xl`: the Artificial Analysis Intelligence Index **image** (`/BRAND_ASSETS/intelligence-index.png`, 2560×938 upscale of the 1024×375 source, pure-white bg) rendered **borderless** so it blends into the white page. Below `xl` the image stacks under the list and the list is **centered** (`mx-auto … xl:mx-0`). Row is `max-w-[88rem] xl:max-w-[112rem]`; on ≥~1900px the image matches the list's vertical extent. Credit **facts by artificialanalysis.ai**. No local score snapshot (`web/lib/intelligence-index.ts` removed); no frame/radius/shadow on the image.
- Home `#use-now` heading is cycling words only (no static lead-in): **Luv with everything down here** → **Thanks**, 3s hold, HelveticaNeue-Bold, centered. Under the cycle, **facts by openrouter.com** uses the same `.hero-neuralwatt` UltraLight Italic, center, and `mb-[30px]` as Infrastructure. Then one even shrink-wrapped provider list (75px marks, 15px names): Cursor, Hermes, VS Code, FreeBuff, Open WebUI, Kilo Code, Codex. Cursor is **Free and Paid** in the same list as the rest. Open goes to that client’s OpenRouter `/apps` page. Open pills use a mild magnetic follow (`MagneticButton`), white fill / black type, clamped to each row so they cannot cross the divider.
- Home `#models` list shrink-wraps to the longest row and sits **left**. `#use-now` list still shrink-wraps and centers. Do not stretch either to `max-w-2xl`.
- Out Now / Pair With Now rasters use `ShieldedImage` (CSS background, not `<img>`). Middleware 404s document navigations to `/BRAND_ASSETS/models/*` and `/BRAND_ASSETS/clients/*`.
- Hero (below the `luv13` mark): a full-bleed text strip inside the red field, `open-sourced | low price | ai models | hosted by Neuralwatt.com |` repeated, sliding via `InfiniteSlider` at `duration={72}` and decrypting once on load (`text-marquee.tsx` + `decrypt-text.tsx` + `frontend/text-marquee.md` / `frontend/decrypt-text.md`). No band, border, or dots; inherits `--paper`. `luv13` itself decrypts but does not slide. Nothing renders below the footer.
- The empty red below the hero strip is **intentional** (the frame keeps its ~390px bottom padding). Do not "tighten" it, and keep the strip high under `luv13` rather than at the bottom edge of the field. Decrypt runs **once per load** — no loop, no hover replay.
- Model cards use shadcn card-05 metric layout: name · provider · context · input $/M · caps · rate rows · Try Now / Request access.
- Scroll: Lenis is **desktop-wheel only** (`(hover: hover) and (pointer: fine)`, `syncTouch: false`). Touch devices run fully native compositor scroll — never re-enable JS touch smoothing (`syncTouch: true` was the cause of reported iPhone choppiness). `SmoothScroll` sets `documentElement.dataset.scroll` = `lenis` | `native-touch` | `reduced`. `InfiniteSlider` pauses its rAF loop when offscreen or the tab is hidden.
- Cursor exchange constant: **$1.15 ↔ 1M tokens** (`CURSOR_USD_PER_MILLION_TOKENS`).
- Catalog facts match Neuralwatt portal pages (Kimi K3/K3 Fast, GLM 5.3/5.3 Flash/5.2, DeepSeek V4 Flash / V4.1 Flash / V4-Pro, Qwen 3.8 27B, Qwen3 Embedding 8B, Gemma 4 31B). Kimi K3 input is **$3.00**/M (portal), not $1.15.

## Curator
- tasks_since_curator: 7
- last_pass: 2026-09-13 — patched luv13-production-deploy (Tailscale SSH, container is luv13-web not luv13/lub13, public IP 71.209.202.110; added `/BRAND_ASSETS` guard test note — guard reads `Sec-Fetch-Dest`, plain curl won't trigger it). No archives. Also 2026-09-13: intelligence chart became a borderless static image (`/BRAND_ASSETS/intelligence-index.png`); removed `web/lib/intelligence-index.ts`; two-column split moved `lg`→`xl`; model list centered when stacked. Re-deployed pm after privacy/terms + marquee/chart/slides changes; `luv13-web` recreated 18:09 local.
