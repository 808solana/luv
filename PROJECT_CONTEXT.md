# Project Context

LUV13 marketing site + customer account UI in `web/`, FastAPI backend elsewhere in monorepo.

## Reload / splash
- None. Reload paints the page directly with no overlay.

## Home page
- Page base is white. Hero is **ungated**: visitors land already in and can scroll immediately.
- Hero: compact `luv13` mark (Bold, `--paper` on `#fe0000`) that **decrypts once on load** (`DecryptText`, no slide), then a full-bleed **text strip inside the red field** directly under it — `open-sourced | low price | ai models | hosted by Neuralwatt.com |` repeated, sliding via `InfiniteSlider` at `duration={72}` (half speed), each repeat also decrypting once. No band, no border, no dots; `text-paper` is inherited from the surface. Solid red field (no pale wash), white gap before Neuralwatt. No `.ai` suffix, no subline, no enter button. Models / Use Now / API stay white. Menu hashes `#models` / `#use-now` / `#api` / `#pricing` still jump to those sections.
- Scroll order: models (compact stacked list) → Use Now → API (base URL).
- `#models` visible heading is **Infrastructure by Neuralwatt.com** (UltraLight Italic, `.hero-neuralwatt`). Under it: hosted catalog **left**, Artificial Analysis Intelligence Index **image** **right** from `xl`; below `xl` it stacks (list then image) with the list **centered**. The chart is a static raster at `web/public/BRAND_ASSETS/intelligence-index.png` (2560×938 — the supplied 1024×375 chart pre-upscaled ~2.5× so the browser down-scales instead of up-scaling; pure-white background) rendered **borderless** so it blends into the white page — no card, frame, radius, or shadow. On ≥~1900px viewports the image lines up with the list top-to-bottom (Kimi K3 → Qwen 3.8); at ~1440px the 2.73:1 ratio makes that impossible. Credit **facts by artificialanalysis.ai** links to `https://artificialanalysis.ai/#intelligence`. There is no `web/lib/intelligence-index.ts` snapshot anymore.
- Browser tab title is `luv13` (lowercase, no “LUV13 — …” suffix).
- Typography: **HelveticaNeue-Bold** from `web/public/BRAND_ASSETS/HelveticaNeue-Bold.ttf` is the UI face (`--font-sans` / `--font-serif` / `--font-helveticaneue-bold`). Designated subtext may use **HelveticaNeueUltraLightItalic** (`HelveticaNeueUltraLightItalic.otf`). Instrument Serif is retired. `font-mono` only for keys, URLs, IDs.
- Use Now (`#use-now`): heading is cycling words only — **Luv with everything down here** → **Thanks**, 3s hold — centered; then **facts by openrouter.com** (`.hero-neuralwatt`, same UltraLight Italic / size / `mb-[30px]` as Infrastructure); then one even shrink-wrapped list: Cursor, Hermes, VS Code, FreeBuff, Open WebUI, Kilo Code, Codex. Open buttons go to OpenRouter `/apps` pages and use a mild magnetic follow, clamped to each row. No looping logo bar, no client cards, no model-logo cloud. Primitive: `web/components/ui/cycling-words.tsx`. Data: `web/lib/client-providers.ts`.
- `#models` list sits on the **left** of `#models` (shrink-wrapped). Do not center it on the page once the Intelligence chart is on the right — that was the old single-column axis.
- Public catalog source of truth: `web/lib/models.ts`. Portal scrape workflow: `.cursor/skills/frontend/add-portal-models.md`.
- API strip: base URL copy chip, Create account, Log in. Anchor `#api`.
- Marketing chrome: fixed **transparent** header + footer on `MarketingShell` pages. No logo in the header. Home overlays the red hero (`overlayHeader`). Desktop nav is Models (`/#models`) and Keys (`/keys`). Mobile hamburger only. Footer columns + **LEV 13 © 2026**. `/terms` and `/privacy` are honest placeholders.
- Hero strip: `web/components/marketing/text-marquee.tsx` sits inside `.home-hero-frame` as a sibling after the `#hero` section — full-bleed (zero horizontal padding, inherits `--paper`), `DecryptText` per repeat plus `InfiniteSlider` at `duration={72}`. `MarketingShell` no longer has a `bottomBand` prop, and nothing renders below the footer. The empty red below the strip is **intentional** (the frame keeps its ~390px bottom padding) — do not tighten it or move the strip to the field's bottom edge. Decrypt runs once per load, never looped or hover-replayed.
- Scroll: Lenis smooth **wheel, desktop only** (`(hover: hover) and (pointer: fine)`, `syncTouch: false`); touch devices use native compositor momentum scroll with no JS hijack. Compact hero has no `HomeScrollFx`. The `InfiniteSlider` marquee pauses its rAF loop when offscreen or the tab is hidden. Respects `prefers-reduced-motion`.
- Out Now / Pair With Now rasters are painted with `ShieldedImage` (CSS background). `web/middleware.ts` 404s opening those files as a document so “Open image in new tab” has nothing to show.

## shadcn UI
- Components live under `web/components/ui/` (`card`, `badge`, `card-05`, …).
- Dependencies already present: `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`.

## Production
- Canonical live origins: `https://luv13.ai` (web, NPM → host `:3100`) and `https://api.luv13.ai`. Host is Debian 13 mini-PC `kor` over Tailscale.
- Running containers: `luv13-web`, `luv13-api`, `luv13-proxy`. Speech “luv13” / typo “lub13” means `luv13-web`.
- Full local tree (no secrets) also lives on host at `/home/kor/luv`. Deploy skill: `.cursor/skills/tooling/luv13-production-deploy.md`.
