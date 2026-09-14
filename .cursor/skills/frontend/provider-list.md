---
name: provider-list
description: Use when adding or editing the Luv With stacked client rows (Cursor, Hermes, VS Code, FreeBuff, Open WebUI, Kilo Code, Codex). Compact even list matching the models chart, with kind / Free|Paid / Open to OpenRouter /apps pages.
created: 2026-09-11
updated: 2026-09-12
tags: [frontend, marketing, clients, list]
---

# Pair-with provider list (home)

## When to Use
- Home `#use-now` client rows under **Luv With**
- Adding a pair-with product, changing kind copy, access, or Open URL
- Don't use when: hosted model list (`#models`), `/models` directory cards, or the unused infinite-slider primitive

## Steps
1. Layout: `web/components/marketing/provider-pane.tsx` — one even stacked list (same row height, logos on one vertical line, `divide-y` between every row). Logo `size-[4.6875rem]` (75px, 25% down from the 100px pass), name `15px`, facts `12px`. Unframed `ShieldedImage`, name to the right of the mark. Shrink-wrap (`w-max max-w-full` inside `flex justify-center`). Do **not** split Cursor into its own group.
2. Data: `web/lib/client-providers.ts` `CLIENT_PROVIDERS`.
3. Wire: `web/components/marketing/use-now.tsx` under the cycling title.
4. Open is a compact bordered pill (`target="_blank"`) wrapped in `MagneticButton` (`web/components/ui/magnetic-button.tsx`). White pill, black type. Follow is mild and clamped to the row (`data-magnetic-bounds` + `overflow-hidden` on the list item) so it cannot cross the divider.

## Row
```
[logo]  Cursor
        Coding agent and IDE   Free and Paid   [Open]
```

## Caption map
| Title | Kind | Access |
| --- | --- | --- |
| Cursor | Coding agent and IDE | Free and Paid |
| Hermes | Personal everything agent | Free |
| VS Code | IDE extensions | Free |
| FreeBuff | Coding agent | Free |
| Open WebUI | General chat | Free |
| Kilo Code | IDE extension, coding agent, CLI agent | Free |
| Codex | Coding agent, CLI agent, IDE agent | Free |

## Open URLs (OpenRouter apps)
| Client | href |
| --- | --- |
| Cursor | `https://openrouter.ai/apps/url/https%3A%2F%2Fcursor.com%2F` |
| Hermes | `https://openrouter.ai/apps/hermes-agent` |
| VS Code | `https://openrouter.ai/apps/url/https%3A%2F%2Fcode.visualstudio.com%2F` |
| FreeBuff | `https://openrouter.ai/apps/url/https%3A%2F%2Ffreebuff.com%2F` |
| Open WebUI | `https://openrouter.ai/apps/open-webui` |
| Kilo Code | `https://openrouter.ai/apps/kilo-code` |
| Codex | `https://openrouter.ai/apps/codex` |

## Pitfalls
- Do not stamp Cursor as Paid-only. The editor is free; models + custom base URL are paid.
- Do not split Cursor into a separate group — that drops its divider and makes it look larger/higher than the rest.
- Do not link Open to product homepages or OpenRouter cookbook docs. Use `/apps` pages.
- Do not restore `ClientLogoSlider`.
- Do not put these marks on `<img>`. See `shielded-images.md`.
- Do not scale this list back up to 100px / 19px — that overpowers the models chart.
- Do not drop the magnetic clamp. Open pills must not drift across row dividers.
- Do not restyle Open to indigo/blue. White fill, black type.

## Verification
- [ ] Seven even rows with dividers between each
- [ ] Cursor access reads **Free and Paid**; others **Free** unless specified
- [ ] Logos 75px, names 15px, facts 12px
- [ ] Open goes to the OpenRouter `/apps` URL, new tab
- [ ] Open pills magnetically follow the pointer inside their own row only
- [ ] `#use-now` contains zero `<img>` nodes

## Usage
- count: 5
