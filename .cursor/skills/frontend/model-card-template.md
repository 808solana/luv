---
name: model-card-template
description: Use when adding or editing public model cards on /models or home slides. card-05 metric face with provider rates + Cursor $1.15↔1M exchange.
created: 2026-09-08
updated: 2026-09-13
tags: [frontend, models, marketing, pricing, shadcn]
---

# Public model card template (card-05)

## When to Use
- `/models` directory cards (`ModelCard`)
- Home model slideshow content that mirrors directory
- Don't use when: dashboard metering, internal cost accounting

## Face layout (shadcn card-05 spirit)
1. **Name** + **provider** under it
2. Optional **Preview** badge (top-right)
3. **Metric pair** (muted tiles like card-05):
   - Context — provider figure (`1048.576K`, `262.144K`, `8.192K`)
   - Input Price — `$X.XX` + `/M tokens`
4. **Cursor exchange line** — always `$1.15 ↔ 1M Cursor tokens`
5. **Capability chips** — Reasoning / Tools / Vision / JSON / Flex / Embedding (colored)
6. **Effort** line when present
7. **Rate rows** — Input / Cached input / Output (`$X.XX/M tokens`)
8. **CTAs** — Try Now | Request access + Details

## Cursor pricing fact
- `CURSOR_USD_PER_MILLION_TOKENS = 1.15`
- 1 million tokens = $1.15 USD and $1.15 USD = 1 million tokens
- Helpers: `formatCursorExchange`, `cursorTokensForUsd` in `model-directory.ts`

## Data
- Catalog: `web/lib/models.ts` (screenshot-accurate rates)
- Types/formatters: `web/lib/model-directory.ts`
- UI: `web/components/ui/card.tsx`, `badge.tsx`, `card-05.tsx`
- Card: `web/components/models/model-card.tsx`

## Never invent
- Energy / Avg Energy/Req on the public card (not in current LUV13 face)
- Rates that disagree with the source provider screenshot

## Verification
- [ ] Flash: 1048.576K, $0.14/M, cached $0.03, output $0.28, Try Now
- [ ] V4-Pro: Preview + Request access, $1.00 / $0.10 / $3.00
- [ ] Cursor line shows `$1.15 ↔ 1M Cursor tokens`
- [ ] `npm test -- components/models/model-card.test.tsx`

## Usage
- count: 3
