---
name: 21st-dev-theme-install
description: Use when installing a 21st.dev shadcn theme into a Tailwind v4 CSS-first project. Captures the token-bridge merge workflow and the reliable CSS-extraction path.
created: 2026-07-12
updated: 2026-07-12
tags: [frontend, tailwind-v4, shadcn, 21st-dev, theme, oklch]
---

# Install a 21st.dev theme into a Tailwind v4 project

## When to Use
- Installing a public theme from `https://21st.dev/@<user>/themes/<slug>` (or components).
- The target project uses Tailwind CSS v4 (`@import "tailwindcss"` + `@theme inline {}` in `globals.css`), NOT v3.
- Any shadcn-style token system (`:root` / `.dark` CSS vars) that must coexist with a project's own `@theme inline` color tokens.

## When NOT to Use
- Tailwind v3 projects (use `tailwind.config.js` `theme.extend` instead of `@theme inline`).
- Plain CSS without Tailwind — no bridge needed.
- Publishing TO 21st.dev (different flow; needs a `:root` + `.dark` CSS file export).

## Steps
1. **Confirm the theme's color format BEFORE writing any bridge.** Open the theme page in the browser and read the color-button labels — they print the format (`oklch(...)`, `hsl(...)`, etc.). Serafim's themes ship **oklch channel triplets** (`L C H` space-separated), used as `oklch(var(--token))` at the call site. Do NOT assume HSL.
2. **Do NOT run `npx shadcn@latest init`.** It rewrites `globals.css` and clobbers custom classes. Instead hand-craft `components.json` (see template below).
3. **Back up first:** `Copy-Item app/globals.css app/globals.css.bak`.
4. **Fetch the theme tokens** (in reliability order):
   a. Try `WebFetch https://21st.dev/r/<user>/themes/<slug>.json` and the `/api/themes/<user>/<slug>` shape — fast if they resolve.
   b. If they 404, use the **cursor-ide-browser MCP**: navigate to the theme page, then extract tokens via CDP `Runtime.evaluate` calling `getComputedStyle(document.documentElement)` on the known `--background`, `--foreground`, etc. variable list. This is the reliable path — the rendered preview proves the tokens are live.
   c. To capture BOTH light and dark: the page usually defaults to one mode (often dark, with `html.dark`). Read that set, then `classList.remove('dark')`, read again (light `:root` values), then `classList.add('dark')` to restore.
   d. The "Copy CSS" button on 21st.dev requires auth AND a focused document for clipboard read — it's unreliable when the browser tab is backgrounded. Prefer computed styles.
5. **Merge into `globals.css`:**
   - Add `:root { --background: <L C H>; ... }` (light) and `.dark { ... }` (dark) blocks with the raw triplets from step 4.
   - In the existing `@theme inline {}`, rewrite the `--color-*` entries to bridge to the theme vars using the **actual format**: `--color-background: oklch(var(--background));` (oklch) or `--color-background: hsl(var(--background));` (hsl). Match the format to whatever the theme ships.
   - Preserve every project-specific block verbatim: `@import`s, `@font-face`, brand font vars, `html { background }` scroll-video fallback, Lenis classes, `body { background: transparent }`, `liquid-glass*`, `@keyframes`, `@media (prefers-reduced-motion)`.
6. **Verify:** `npm run build` (exit 0); `GET /api/health` → 200; visual check at 375/768/1280px. Keep `globals.css.bak` until confirmed.

## components.json template (Tailwind v4, new-york style)
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "", "css": "app/globals.css", "baseColor": "neutral", "cssVariables": true, "prefix": "" },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
```
Adjust `baseColor`, `iconLibrary`, and aliases to match the target project's `tsconfig.json` paths and `lib/utils.ts`.

## Pitfalls
- **Assuming HSL.** Serafim's 21st.dev themes use oklch triplets. Building an `hsl(var(--x))` bridge against an oklch theme produces broken/transparent colors. Always read the actual format from the page before bridging.
- **`shadcn init` clobbering.** Running init rewrites `globals.css` from scratch and deletes custom classes. Hand-craft `components.json` instead; `shadcn add` for individual components is safe afterward.
- **Clipboard in a backgrounded browser tab.** `navigator.clipboard.readText()` throws `NotAllowedError: Document is not focused` when the MCP browser tab isn't focused. Use CDP `Runtime.evaluate` with `getComputedStyle` instead.
- **Reading only one mode.** A theme page may default to dark. If you only read `:root` computed styles while `html.dark` is set, you get the DARK overrides, not the `:root` light values. Toggle the `.dark` class off, read, restore.
- **Empty `--sidebar`.** Some 21st.dev previews leave `--sidebar` undefined (inherits `--background`). Set `--sidebar: var(--background)` for robustness in both `:root` and `.dark`.
- **Body color on a scroll-video site.** If the project overlays content on a video (`body { background: transparent }`), DO NOT let the theme reintroduce `body { background: var(--background) }`. Keep `transparent`. But `body { color: oklch(var(--foreground)) }` is fine and usually an improvement over a hardcoded literal.

## Verification
- [ ] `npm run build` exits 0 with no type errors.
- [ ] `GET /api/health` returns 200.
- [ ] Dark and light tokens both present in `globals.css` (`:root` + `.dark`).
- [ ] `@theme inline` `--color-*` refs use the theme's actual format (`oklch(var(--x))` / `hsl(var(--x))`).
- [ ] Custom classes (liquid-glass, Lenis, @font-face, scroll-video bg, reduced-motion) unchanged — diff `globals.css.bak` to confirm.
- [ ] `components.json` exists and points at `app/globals.css` + `@/lib/utils`.

## Usage
- 2026-07-12: installed Serafim "Vercel" theme into LUV13 (oklch bridge). Build + health verified.
