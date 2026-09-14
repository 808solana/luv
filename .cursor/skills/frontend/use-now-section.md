---
name: use-now-section
description: Use when adding or editing the home-page Use Now strip (cycling heading + stacked provider rows) between the model list and base URL.
created: 2026-09-08
updated: 2026-09-13
tags: [frontend, marketing, home, clients]
---

# Use Now section (home)

## When to Use
- Home section showing where to plug LUV13 in (agent / IDE clients)
- Changing the Use Now heading or its cycling words
- Reordering home sections around the model list ↔ API
- Don't use when: dashboard setup docs, full integration guides

## Steps
1. UI: `web/components/marketing/use-now.tsx` — heading is `CyclingWords` only (centered, HelveticaNeue-Bold), then **facts by openrouter.com** (`.hero-neuralwatt mb-[30px] text-center`, same UltraLight Italic / size / 30px as Infrastructure), then `ProviderPane` (shrink-wrapped, centered stacked rows, same shape as the models list). No static **Luv with** lead-in.
2. Cycling primitive: `web/components/ui/cycling-words.tsx`. Words (in order): **Luv with everything down here**, **Thanks** (capital T, rest lowercase). Hold **3000ms** (`intervalMs={3000}`). Do not restore a constant `Luv with` line or Cursor / Hermes. / VS Code.
3. Provider rows: `web/components/marketing/provider-pane.tsx`. Data: `web/lib/client-providers.ts`. Assets in `web/public/BRAND_ASSETS/clients/`.
4. Wire on `web/app/page.tsx` **after** `ModelSlideshow`, **before** `#api`.
5. Keep anchor `id="use-now"` and hash `/#use-now`.
6. Do not bring back the infinite logo slider, the three cream Client cards, the circular model-logo cloud, the UltraLight “Use luv13's Api Key & Base url” line, or a dumped animated-hero with launch/call buttons.

## Current clients
- Cursor — Coding agent and IDE · Free and Paid · `https://openrouter.ai/apps/url/https%3A%2F%2Fcursor.com%2F`
- Hermes — Personal everything agent · Free · `https://openrouter.ai/apps/hermes-agent`
- VS Code — IDE extensions · Free · `https://openrouter.ai/apps/url/https%3A%2F%2Fcode.visualstudio.com%2F`
- FreeBuff — Coding agent · Free · `https://openrouter.ai/apps/url/https%3A%2F%2Ffreebuff.com%2F`
- Open WebUI — General chat · Free · `https://openrouter.ai/apps/open-webui`
- Kilo Code — IDE extension, coding agent, CLI agent · Free · `https://openrouter.ai/apps/kilo-code`
- Codex — Coding agent, CLI agent, IDE agent · Free · `https://openrouter.ai/apps/codex`

## Pitfalls
- Do not put Luv With above the model stack or after base URL without an explicit reorder request.
- Public site: no internal provider names — only LUV13 + client product names.
- `prefers-reduced-motion` freezes the heading on **Luv with everything down here**. The list is already still (no marquee).
- Do not fill this list with Unsplash/lucide stock logos.
- Do not set UltraLight as `--font-sans`. Bold stays the body face. UltraLight is the `#models` Neuralwatt heading and the `#use-now` OpenRouter credit only.
- Marks use `ShieldedImage`, not `<img>`. See `shielded-images.md`.
- Row facts have **no muted labels** (no Context / Price / ID). Kind, Free/Paid, then an Open pill wrapped in `MagneticButton` that `target="_blank"`s the OpenRouter `/apps` page.
- Do not paste the shadcn animated-hero demo wholesale — extract only the vertical word cycle.

## Verification
- [ ] Visible heading is the cycling slot only (HelveticaNeue-Bold), centered
- [ ] Cycle order: Luv with everything down here → Thanks, ~3s hold
- [ ] **facts by openrouter.com** sits between the cycle and Cursor, matching Infrastructure (`.hero-neuralwatt`, centered, `mb-[30px]`)
- [ ] Seven even rows (Cursor through Codex), shrink-wrapped and centered; no looping logo bar
- [ ] Cursor stays in the same list as the others, with dividers; Open goes to OpenRouter `/apps`
- [ ] `/#use-now` jumps to this section

## Usage
- count: 16
