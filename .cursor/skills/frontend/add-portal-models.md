---
name: add-portal-models
description: Use when adding or updating marketing catalog models from portal.neuralwatt.com. Scrape each model page, map into DIRECTORY_MODELS, dedupe by slug/name, keep embeddings out of the home pane.
created: 2026-09-13
updated: 2026-09-13
tags: [frontend, models, catalog, portal, neuralwatt]
---

# Add models from portal.neuralwatt.com

## When to Use
- User pastes `https://portal.neuralwatt.com/models/<slug>` URLs
- Catalog on `/models` or home `#models` is missing a hosted model
- Don't use when: dashboard metering, internal cost accounting, or inventing rates

## Steps
1. Read `web/lib/models.ts` (`DIRECTORY_MODELS` — source of truth), `web/lib/model-directory.ts` (types/formatters), `web/lib/model-slides.ts` (home list), `web/components/models/model-card.tsx`.
2. Fetch **each** portal URL (`WebFetch` and/or `curl` HTML). Extract:
   - Display name, model ID, provider
   - Context length (`262K` → `262_144`, `1048K` → `1_048_576`, `8K` → `8_192`)
   - Token rates: Input / Cached input / Output ($/M)
   - Capability Yes/No: Vision, Tool Use, JSON Mode, Reasoning, Flex (top chips)
   - Reasoning effort string
   - Preview banner → `badges: ["Preview"]`, `cta: "request_access"` unless the page still offers Try
   - Description / tags
3. **Dedup** by `identifier` (portal slug) **and** display name. Same model → one row; update rates/caps from the portal. Different slug (e.g. `deepseek-v4-flash` vs `deepseek-v4.1-flash`, `glm-5.3` vs `glm-5.3-flash`) → add.
4. `id` replaces `.` with `-` (`qwen-3.8-27b` → `qwen-3-8-27b`, `deepseek-v4.1-flash` → `deepseek-v4-1-flash`). `identifier` keeps the portal slug.
5. Embedding models: `capabilities: ["embedding"]` only. Add to `HIDDEN_FROM_PANE`. Do not treat as chat (no reasoning/tools/vision).
6. Home pane (`MODEL_PANE_SLIDES`): reuse family covers in `COVERS`. Hide rows with no mark (do not fall back to the DeepSeek whale). Hide GLM-5.2. Append new chat models to `PANE_ORDER`.
7. New capability values need `CAPABILITIES`, `capability-badge.tsx` labels/tones, and optionally `model-filters.tsx` `quickFilters`.
8. Update `web/components/models/model-card.test.tsx`. Run `npm test -- components/models/model-card.test.tsx` from `web/`.
9. Verify `/models` in the browser: new names, context, prices; no duplicate cards.

## Portal field map
| Portal | Catalog |
| --- | --- |
| Model ID | `identifier` |
| Context Length | `contextTokens` |
| Input / Cached / Output | `rates.*PerMillion` |
| Vision Support Yes | `vision` |
| Tool Use Yes | `tools` |
| JSON Mode Yes | `json` |
| Reasoning Yes | `reasoning` |
| Flex chip | `flex` |
| Embedding model | `embedding` |
| Reasoning Effort | `effort` |
| “is in preview” | `badges: ["Preview"]` |

Do **not** copy energy ($/kWh, mWh) onto the public card.

## Pitfalls
- Markdown scrapes often omit Yes/No next to Vision/Tool/JSON/Reasoning — parse the HTML (`Vision Support Yes`).
- Kimi K3 Fast has **Reasoning No**; do not copy Kimi K3’s reasoning chip.
- GLM 5.3 has Vision No / JSON No / Flex Yes — not the same as GLM-5.3 Flash (vision yes).
- Prefer portal numbers over older screenshot catalog (e.g. Kimi K3 input is portal `$3.00`, not `$1.15`).
- No Gemma mark in `BRAND_ASSETS/models/` — keep `gemma-4-31b` off the home pane until art exists.

## Verification
- [ ] Each new portal slug appears once in `DIRECTORY_MODELS`
- [ ] `/models` cards show name, context (`1048.576K` / `262.144K` / `8.192K`), input price
- [ ] Embedding card has Embedding chip, not Reasoning
- [ ] Home `#models` has new chat rows with the right family logo; no embedding row; no second GLM-5.2
- [ ] `npm test -- components/models/model-card.test.tsx`

## Usage
- count: 1
