---
name: copy-to-clipboard-component
description: Use when building a "copy to clipboard" button in a React/Next app — covers the navigator.clipboard API with execCommand fallback, icon cross-fade animation, and SSR-safe state.
created: 2026-07-03
updated: 2026-07-03
tags: [frontend, react, next, animation, accessibility]
---

# Copy-to-Clipboard Component

## When to Use
- Adding a "copy this text" button next to a code block, URL, API key, token, or snippet.
- Needing SSR-safe behavior (no hydration mismatch) with a satisfying copied-confirmation animation.

## Steps
1. Component is `"use client"` — clipboard + animation are client-only.
2. Copy handler: `await navigator.clipboard.writeText(value)` in a try; on catch, create a hidden `<textarea>`, `select()`, `document.execCommand("copy")`, then remove it.
3. Set `copied=true`, clear with `setTimeout(..., 2000)`.
4. Icon swap with `<AnimatePresence initial={false}>`: render the active icon (copy vs check) in an absolutely-positioned `motion.span`. Enter/exit use `{opacity, scale 0.25↔1, filter blur 4↔0}` with a spring transition and **bounce: 0** (the `make-interfaces-feel-better` skill hard-requires bounce 0).
5. Button a11y: `type="button"`, `aria-label` that flips ("Copy X" / "Copied"), visible focus ring, `active:scale-[0.96]`, hit area ≥36–44px.

## Pitfalls
- Calling `navigator.clipboard` during SSR or without a user gesture → throws. Always inside the click handler, never at module scope.
- `transition: all` — never. List `transform, opacity` or use Tailwind `transition-transform`.
- Animating `width`/`height` on icon swap → jank. Use `opacity`+`scale`+`blur`.
- Forgetting `initial={false}` on AnimatePresence plays the enter animation on first mount.
- `execCommand` is deprecated but still the only reliable fallback on non-secure (`http://`) origins and old Safari; keep it.

## Verification
- [ ] Click copies text (paste elsewhere to confirm).
- [ ] Check icon appears, reverts to copy icon after ~2s.
- [ ] No hydration warning in console from this component (it's `"use client"`, state starts at `false`/default icon on both server and client).
- [ ] `npm run build` exits 0 with no TS errors.
