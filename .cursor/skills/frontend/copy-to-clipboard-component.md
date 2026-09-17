---
name: copy-to-clipboard-component
description: Use when building or changing a "copy to clipboard" control in this app — the shared copyText() helper in web/lib/clipboard.ts, the execCommand fallback and its focus theft, the icon cross-fade, and the one-action-one-tab-stop rule for duplicate controls.
created: 2026-07-03
updated: 2026-09-16
tags: [frontend, react, next, animation, accessibility, clipboard]
---

# Copy-to-Clipboard Component

## When to Use
- Adding a "copy this text" button next to a code block, URL, API key, token, snippet, or e-mail address.
- Needing SSR-safe behavior (no hydration mismatch) with a satisfying copied-confirmation animation.
- Making a piece of visible text itself click-to-copy (e.g. the contact section's `hi@luv13.com`) with an optional icon button beside it.
- Don't use when: the control should *navigate* (`mailto:`, a URL) — that is an `<a>`, not a copy control.

## Steps
1. **Always import the shared helper — never rewrite the fallback.** `import { copyText } from "@/lib/clipboard";` then `await copyText(value)`. It is the single implementation of: `navigator.clipboard.writeText` first, and on rejection a hidden `<textarea>` + `document.execCommand("copy")`. Callers: `base-url-display.tsx` (hero base-URL pill), `copy-field.tsx`, `contact-16.tsx` (the e-mail row). **Adding a fourth inline copy of that block is the failure mode this helper exists to prevent.**
2. Component is `"use client"` — clipboard + animation are client-only.
3. Set `copied=true`, clear it in a `useEffect` **keyed on the flag** (not a bare `setTimeout` in the handler) so the timer is cleared on unmount:
   ```tsx
   React.useEffect(() => {
     if (!copied) return;
     const timer = window.setTimeout(() => setCopied(false), COPIED_HOLD_MS);
     return () => window.clearTimeout(timer);
   }, [copied]);
   ```
   `COPIED_HOLD_MS = 2000` is the house value (the hero pill and the contact e-mail row both use it).
4. Icon swap with `<AnimatePresence initial={false}>`: render the active icon (copy vs check) in an absolutely-positioned `motion.span`. Enter/exit use `{opacity, scale 0.25↔1, filter blur 4↔0}` with a spring transition and **bounce: 0** (the `make-interfaces-feel-better` skill hard-requires bounce 0).
5. Button a11y: `type="button"`, `aria-label` that flips ("Copy X" / "Copied"), visible focus ring, `active:scale-[0.96]`, hit area ≥36–44px. The house hit-area trick is a 36px face plus `after:absolute after:-inset-1 after:content-['']` → **44px**.
6. **If the visible text is the copy control and you also want an icon button, keep exactly one tab stop** — see the pitfall below.

## Two controls, one action

The contact e-mail row is the reference shape: the address is a `<button>` whose visible text *is* the value, and a small icon button sits beside it as the pointer-sized twin of the same action.

- The **text button** is the accessible control. Its `aria-label` should state the **action**, not repeat the visible text, because the visible text is already the value: `aria-label={copied ? "Email address copied" : \`Copy ${EMAIL} to clipboard\`}`.
- The **icon button** is marked `aria-hidden="true"` and `tabIndex={-1}`. It is a duplicate of an action already exposed; leaving it focusable gives keyboard users two stops, two names, and one action.
- Because the icon is hidden from AT, add a `role="status"` `sr-only` region (`${EMAIL} copied to clipboard`) to announce success — `role="status"` carries implicit `aria-live="polite"` + `aria-atomic`.
- Keep the text control's classes otherwise identical to its neighbouring links (`cursor-pointer` + `select-text` were the only deltas in the contact row), so it reads as one of the set. `select-text` lets someone copy by hand.
- Verified result: the a11y tree lists `button Copy hi@luv13.com to clipboard` and **no** icon button; the tab order through the section is 6 stops, not 7.

## Pitfalls

- **The `execCommand` fallback steals focus — restore it.** It must focus and select the hidden textarea to work, so focus leaves the control the visitor pressed; removing the textarea then drops focus to `<body>`, meaning a keyboard user loses their place in the tab order and the `focus-visible` ring disappears. `copyText` captures `document.activeElement` first and refocuses it afterwards when it is still `isConnected`. **Skip the restore for a detached node** — a caller that unmounts on copy would otherwise focus something no longer in the document.
- **The fallback is not dead code.** It runs whenever `navigator.clipboard.writeText` rejects — a non-secure origin (`http://` on a LAN address, e.g. testing on a phone), or an unfocused document (`NotAllowedError: Document is not focused`). Both were observed on this project. Never "simplify" it away, and keep `execCommand`'s own failure swallowed: by then there is no third mechanism, and throwing would turn "the clipboard did not work" into "the click handler crashed".
- **Don't probe an `AnimatePresence` swap with `querySelector('svg')`.** During the cross-fade both children are in the DOM and the **outgoing** one comes first in document order, so a single post-click probe reports the *previous* icon's class. Sample a timeline instead (idle → both → new only → both → old only); the real cadence is `copy` → both at ~150ms → `check`-only to ~2000ms → both → `copy`-only by ~2450ms. A single probe looks exactly like inverted logic.
- Calling `navigator.clipboard` during SSR or without a user gesture → throws. Always inside the click handler, never at module scope.
- `transition: all` — never. List `transform, opacity` or use Tailwind `transition-transform`.
- Animating `width`/`height` on icon swap → jank. Use `opacity`+`scale`+`blur`.
- Forgetting `initial={false}` on AnimatePresence plays the enter animation on first mount.
- **Don't render the copy control as a `<div onClick>` or an `<a href="#">`** — it is a `<button type="button">`.
- **Don't put `aria-hidden="true"` on an element that receives focus.** The hidden textarea in the fallback is deliberately *not* marked `aria-hidden` for this reason; it is only in the DOM for the duration of the copy.

## Verification
- [ ] Click the control: it copies the right string (spy on `navigator.clipboard.writeText` **and** `document.execCommand` to see which path ran), and no error is thrown when the API rejects.
- [ ] Check icon appears, reverts to the copy icon after ~2s; sample the icon class over a timeline rather than once (both children coexist mid-cross-fade).
- [ ] Focus is **still** on the control after the copy (the fallback must not leave focus on `<body>`).
- [ ] No hidden textarea is left behind: `[...document.querySelectorAll('textarea')].filter(t => getComputedStyle(t).position === 'fixed').length === 0`.
- [ ] If the visible text is the control and an icon sits beside it: the icon is `aria-hidden` + `tabIndex={-1}`, and a `role="status"` region announces the copied state.
- [ ] Tab order includes the copy control exactly **once**.
- [ ] No hydration warning in console from this component (it's `"use client"`, state starts at `false`/default icon on both server and client).
- [ ] `npm run build` exits 0 with no TS errors.

## Usage
- count: 3
- 2026-09-16 — extracted `copyText()` into `web/lib/clipboard.ts` and pointed `base-url-display.tsx` + `copy-field.tsx` at it; used it for the new contact-section e-mail row (`hi@luv13.com`, click-to-copy text + icon twin). Found and fixed the fallback's focus theft, and documented the `aria-hidden`/`tabIndex={-1}` pattern for a duplicate pointer affordance.
- 2026-08-13: Reused for one-time API-key, base URL, model slug, and curl copy controls.
