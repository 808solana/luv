---
name: provider-list
description: Archived 2026-09-15. The #use-now client rows were replaced by a full-bleed marquee; see frontend/client-marquee.md. Kept for the retired caption map (kind / Free-Paid) and the OpenRouter /apps URLs.
created: 2026-09-11
updated: 2026-09-15
status: stale
tags: [frontend, marketing, clients, list, archive]
---

# Pair-with provider list (archived)

**Do not rebuild this.** On 2026-09-15 the user called the stacked list *"too big, too
long, and a bit ugly"* and asked for *"just images with the name"* at full bleed, so
`web/components/marketing/provider-pane.tsx` was **deleted** and replaced by the
marquee documented in `.cursor/skills/frontend/client-marquee.md`
(`web/components/marketing/client-marquee.tsx`).

The live row is now **image + name only**: `kind`, `access`, and `alt` were dropped
from `web/lib/client-providers.ts`, and the Open pill is gone (the whole card is the
`<a>`). This file is the historical record of the removed copy and of the OpenRouter
`/apps` URLs (which are still live — they moved onto the card).

What also died with it: the `py-3.5` / 75px `size-[4.6875rem]` row, the
`divide-y divide-black/10` stack, the shrink-wrap + `flex justify-center` centering,
and the `MagneticButton` clamped Open pill (`data-magnetic-bounds` + `overflow-hidden`).
The **row-scale lockstep with `model-pane.tsx`** was retired with it — `#models` keeps
`py-3.5` + 75px marks, the pair list no longer has rows.

## Retired caption map
| Title | Kind | Access |
| --- | --- | --- |
| Cursor | Coding agent and IDE | Free and Paid |
| Hermes | Personal everything agent | Free |
| VS Code | IDE extensions | Free |
| FreeBuff | Coding agent | Free |
| Open WebUI | General chat | Free |
| Kilo Code | IDE extension, coding agent, CLI agent | Free |
| Codex | Coding agent, CLI agent, IDE agent | Free |

## Open URLs (OpenRouter apps) — still live, now the whole card
| Client | href |
| --- | --- |
| Cursor | `https://openrouter.ai/apps/url/https%3A%2F%2Fcursor.com%2F` |
| Hermes | `https://openrouter.ai/apps/hermes-agent` |
| VS Code | `https://openrouter.ai/apps/url/https%3A%2F%2Fcode.visualstudio.com%2F` |
| FreeBuff | `https://openrouter.ai/apps/url/https%3A%2F%2Ffreebuff.com%2F` |
| Open WebUI | `https://openrouter.ai/apps/open-webui` |
| Kilo Code | `https://openrouter.ai/apps/kilo-code` |
| Codex | `https://openrouter.ai/apps/codex` |

## Facts from this variant worth not re-deriving
- Cursor is **Free and Paid** — the editor is free; models + a custom base URL are paid. Never stamp it Paid-only.
- Cursor was never split into its own group: a second group drops its divider and makes it look larger/higher than the rest.
- Open links go to the OpenRouter `/apps` pages, never product homepages or cookbook docs.
- Do not fill this row with Unsplash / lucide stock logos — the marks are the real brand rasters in `web/public/BRAND_ASSETS/clients/`.
- `ClientLogoSlider` and `InfiniteSlider`-as-logo-bar are still forbidden as a *list* replacement. The marquee that replaced this list is its own component (`client-marquee.md`).

## Usage
- count: 5 (retired)
- 2026-09-11 … 2026-09-14: built, trimmed to 75px rows at the `#models` scale, credit line removed, then archived 2026-09-15 with the marquee swap.
- 2026-09-15: superseded by `frontend/client-marquee.md`.
