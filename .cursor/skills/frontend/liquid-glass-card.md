---
name: liquid-glass-card
description: Use when a card/panel/pill on a flat solid color needs a glass-like surface, or needs to be tinted-but-transparent, or fully transparent with just a shadow. Maps the transparency ladder and the exact knobs, the LIGHT-ground recipe for white/near-white fields (`.liquid-glass-pill`), the cascade-layer trap that silently kills hover/focus utilities on the same element, how to rescale the shadow when the element's size changes, and why an SVG refraction filter does nothing on a flat field.
created: 2026-09-14
updated: 2026-09-16
tags: [frontend, css, glass, hero, surface, transparency, shadow, cascade-layers]
---

# Glass / transparent card over a flat field

## When to Use
- A panel on a **flat** color (e.g. the hero's solid `#fe0000`) should read as glass, or as "transparent but present".
- A control on a **light** field (the white `#models` band) needs to read as glass — go straight to `.liquid-glass-pill` below; the ladder in this file is dark-ground.
- You need to move up/down the transparency ladder in response to feel-based feedback ("too bright", "too dark", "make it fully transparent").
- Don't use when: the panel sits on texture/video — there a real refraction filter pays off (`scroll-scrubbed-video.md`).

## There are two recipes, split by the field's brightness
| Field | Class | Rim | Body |
| --- | --- | --- | --- |
| **Dark / saturated** (hero `#fe0000`) | `.liquid-glass-card` (fully transparent `0 8px 18px -10px rgba(72,0,0,.5)` + `0 2px 5px -2px rgba(72,0,0,.26)`) | none | none |
| **White / near-white** (`#models`) | `.liquid-glass-pill` | **crisp** — bright specular inside the top, 0.5px ink ring, dark line under the bottom | a whisper of ink gradient |

**Why the split is mandatory, not stylistic:** the two older generic classes (`.liquid-glass`, `.liquid-glass-strong`, both unlayered and dark-ground) cannot be dropped onto white. `.liquid-glass` has a `rgba(255,255,255,.01)` body and a **white** masked rim ⇒ invisible on white. `.liquid-glass-strong` has a `rgba(0,0,0,.138)` body ⇒ reads as a solid grey chip, and its `blur(80px)` does nothing on a flat field. Pick by the field, not by the vibe.

## The dark-ground transparency ladder (hero)
`.liquid-glass-card` — the **hero control surface**, shared by *both* hero pills since 2026-09-15 (the `Get API Key` link and the base-URL pill are literally the same pill). It was a ~140px-tall card before that. Pick a rung; each one below is strictly more transparent.

| Rung | Background | Backdrop filter | Reads as |
| --- | --- | --- | --- |
| **Frosted glass** | white sheen + low **white** tint | `blur(16px) saturate(1.65) brightness(1.05)` | brighter & more vivid than the field |
| **Restrained glass** | soft top sheen + low **dark** tint | `blur(16px) saturate(0.9) brightness(0.97)` | calmer & slightly deeper than the field |
| **Fully transparent** ← current | `transparent` | `none` | red inside == red outside; only the drop shadow defines the element |

**Current hero state (2026-09-14, shadow rescaled 2026-09-15):** fully transparent — `background: transparent`, `backdrop-filter: none`, drop shadow only.

## `.liquid-glass-pill` — the light-ground recipe (2026-09-16)
Built for the `#models` "Open" pill. `web/app/globals.css`, inside `@layer components`.

```css
.liquid-glass-pill {
  --glass-pill-lift:
    inset 0 1px 1px rgba(255, 255, 255, 1),   /* specular — painted first = on top */
    inset 0 0 0 0.5px rgba(13, 12, 18, 0.07), /* crisp outer ring */
    inset 0 -1px 1px rgba(13, 12, 18, 0.05),  /* dark line under the bottom edge */
    0 1px 2px rgba(13, 12, 18, 0.09),         /* contact */
    0 3px 6px -3px rgba(13, 12, 18, 0.15);    /* lift */
  position: relative;
  background: linear-gradient(180deg, rgba(13,12,18,0.036), rgba(13,12,18,0.058));
  -webkit-backdrop-filter: blur(8px) saturate(170%);
  backdrop-filter: blur(8px) saturate(170%);
  box-shadow: var(--glass-pill-lift);
}
```

**The physics that makes it work, and the one rule that matters: crispness.**
- Frosted glass over white paper transmits the paper but loses ~4-8% at the two surfaces, so the interior reads **slightly darker than the paper** ⇒ the body is ink at ~0.04 on white (~`#f5f5f6`). That tint is what gives the control a body instead of a hole.
- The **top** surface reflects the light source ⇒ a bright specular band just inside the top edge. It is only visible *because the body is tinted*; a white-on-white specular is invisible.
- **Geometry must be hard-edged.** A soft-edged tint plus a diffuse shadow reads as a blurry grey pill; a hard specular + 0.5px ring + tight shadow reads as glass. This was the whole finding of the 2026-09-16 style lab (below) — variant "A" (radial tint + `0 4px 9px -4px`) looked like a smudge, variant "F" (same tint, crisp rims, `0 3px 6px -3px`) looked like glass. **Do not soften these numbers.**
- The low-opacity ink ring is *not* the "hard border" that step 4 forbids: at 0.07 it is a light-catcher, not a hairline. The old `border: 1px solid rgba(0,0,0,.25)` on a white fill — a hollow ring — is what the user rejected as *"a bit odd"*.
- `0.5px` spread is deliberate: the ring is a refinement, and the tinted body already supplies the edge if a 1x display rounds the subpixel spread away.

## Steps
1. Start from the current `.liquid-glass-card`: `background: transparent`, `backdrop-filter: none`, plus a shadow tinted toward the field color:
   `0 8px 18px -10px rgba(72,0,0,0.5)` + `0 2px 5px -2px rgba(72,0,0,0.26)`. Same dark-red tint and same two-layer structure the user signed off on — only the offsets/blur shrank for the smaller element.
2. To add tint back, climb the ladder: add a body tint (`rgba(255,255,255,…)` brightens, `rgba(24,24,24,…)` deepens) and/or a top sheen `radial-gradient(120% 130% at 42% -28%, rgba(255,255,255,0.14) → 0)`, and add the matching `backdrop-filter`.
3. Only add a **bright rim** (inset highlights) if the user asks for a glossy/outlined look: `inset 0 0 0 1px rgba(255,255,255,0.13)` + `inset 0 1px 0 rgba(255,255,255,0.5)` + directional bevels. On the hero it read as a stark **white outline** and was rejected.
4. Never add a hard `border` — a 1px hairline reads plastic. **On a light ground the rim must be inset `box-shadow`, not a `border` and not the masked padding-ring** (that ring is white and disappears here) — this is the one place the "no border" rule and the "needs an edge" need are reconciled.
5. Apply as a class in JSX, keep Tailwind for layout: `className="liquid-glass-card flex h-11 items-center rounded-full pl-4 pr-1 …"`.
6. **When the surface owns the resting `box-shadow`, move the hover/focus rings into the same CSS block too, as `:hover` / `:focus-visible` rules.** If hover is a `hover:shadow-*` utility it *replaces* the lift, and the standard `motion-reduce:hover:shadow-none` twin then strips the element's body entirely under reduced motion. Put the lift in a custom property (`--glass-pill-lift`) and have the reduced-motion `:hover` branch restore it:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .liquid-glass-pill:hover { box-shadow: var(--glass-pill-lift); }
   }
   ```
   Transform utilities (`hover:scale-*`, `active:scale-*`) can stay on the element — they cannot clash with a shadow.

## The style lab (how to choose, instead of guessing)
For feel-based feedback on a surface treatment, **render the candidates side by side before touching the real page**: a throwaway `/tmp/*.html` with the real ground color, the real box (both breakpoints' heights) and the real font, one row per candidate, each shown at true size *and* at `transform: scale(4)`. Then screenshot it headless (`--force-device-scale-factor=2`) and compare. This is what turned "make it glass" into a pick between 7 named variants in ~3 minutes, and it is why the numbers above are what they are. Candidates that were rejected and why: flat ring on a white body = hollow; even grey tint = a secondary button; soft-edged radial tint = a smudge; `0.5px`-ring + ramp = glass.

## Pitfalls
- **Keep the class inside `@layer components`.** Every other class in `globals.css` is unlayered, and **unlayered CSS outranks layered CSS regardless of specificity**. The hero buttons put this class *and* their own Tailwind utilities on the same element, so while it was unlayered, a `background: transparent` / `box-shadow: …` here silently swallowed `hover:bg-white/15` **and the `focus-visible` ring** — with no error, no warning, and no visual difference at rest. If a utility on a `.liquid-glass-card` element ever mysteriously does nothing, check the layer before the spelling. Verify with `CSS.forcePseudoState` + computed styles, never by eye.
- **"Fully transparent" requires killing the backdrop filter too, not just the background.** `brightness(0.9)`/`saturate(0.9)` still alter the backdrop *inside* the element's bounds even with `background: transparent`, so the red reads slightly darker/desaturated there. Set `backdrop-filter: none` for pixel-identical transparency.
- **On a flat, featureless field the backdrop filter is a no-op — say so instead of implying the blur is doing the work.** Behind the `#models` pill there is only `bg-white`, so `blur(8px) saturate(170%)` changes nothing; the tint and the specular are the whole effect. Keep the filter anyway (it is what makes it a *glass* rather than a gradient, and it pays off the moment the surface sits over content), but never present it as the cause.
- **A shadow tuned for a big card has to be rescaled when the element shrinks.** The original `0 22px 50px -22px` + `0 3px 9px -3px` pair belonged to a ~140px card; under a 44px pill the same numbers read as a smear rather than a lift. Scale offsets/blur with the element and keep the tint + layer count — do not swap in a neutral-black shadow.
- **An SVG `feTurbulence`/`feDisplacementMap` refraction layer does nothing visible on a flat field.** No texture behind ⇒ nothing to displace ⇒ pure cost. Skip unless the backdrop has detail (then `scroll-scrubbed-video.md`).
- **Overlay layers — not the backdrop filter — are the real brightness knob.** On pure `#fe0000` the `saturate`/`brightness` above 1 mostly clip to no-ops; a `rgba(255,255,255,0.4)` sheen is what actually lights the element up. This is why the first pass looked "so bright/saturated". To calm: darken the tint and lower the sheen *first*.
- Dark tint over-corrects fast. `rgba(24,24,24,0.09)` mid already read "a bit dark" — if you keep a tint, stay ≤0.06 or go fully transparent.
- Bright inset highlights ≡ a white outline on a red field. If the user says "outline", assume they mean these and remove them.
- Pseudo-elements for the rim paint above non-positioned children — use inset `box-shadow` instead (no stacking-order trap), or wrap content in `relative z-10`.
- Don't set `overflow: hidden` unless something actually overflows — it clips outward focus rings. (`.liquid-glass-pill` needed no `overflow` at all: the body gradient clips to the radius by itself and the rim is a shadow.)
- Keep `border-radius` on the element: gradients clip to its radius automatically, but outer `box-shadow` does not follow a radius set elsewhere.
- A fully transparent surface has **no visible boundary**, so on the hero both controls read as **ghost** pills — there is no solid button left to anchor them. That is intended (the user asked for exactly this). If they want a visible chip, offer `hover`-style white at ≤15% or a hairline, and apply it to **both** pills.

## Verification
- [ ] The rule is inside `@layer components` (not unlayered) — required for the hero pills' `hover:`/`focus-visible:` utilities to land at all.
- [ ] For full transparency: computed `background-color` is `rgba(0,0,0,0)` **and** `backdrop-filter` is `none`.
- [ ] A forced `:hover` / `:focus-visible` on an element that carries this class **does** change computed `background-color` / `box-shadow` (`CSS.forcePseudoState`). If neither moves, the class escaped its layer.
- [ ] `box-shadow` has **no `inset`** layers unless a rim was explicitly requested.
- [ ] On a light field: the computed `box-shadow` still has its `inset` layers, the rim is **crisp** (no large blur radii on the inset layers), and the rim is an inset shadow — not a `border`.
- [ ] Shadow offsets/blur are scaled to the element's size, not inherited from a larger ancestor design.
- [ ] Element is neither brighter nor darker than the field it sits on (unless intended) — check computed styles via CDP `Runtime.evaluate`, not screenshot pixels.
- [ ] No horizontal overflow at 320/375px; outer shadow not clipped by an ancestor `overflow: hidden`.
- [ ] White `text-paper` still legible against the field.

## Usage
- count: 6
- 2026-09-16: **new rung — the light-ground `.liquid-glass-pill`.** The user asked for the `#models` "Open" pill to *"have the liquid glass effect"* (and the magnetic one, see `magnetic-button.md`), calling the existing white-fill-plus-hairline pill *"a bit odd"*. Neither existing class worked on white (see the table above), so the class was written from the physics: ink-tinted body + crisp bright specular + 0.5px ring + dark bottom line + a tight two-layer lift. Chose it against 6 other candidates in a throwaway `/tmp/glass-lab.html` rendered headless at 2x — the decisive variable was **crispness**, not opacity. Also moved the hover/focus rings out of Tailwind utilities and into the class (see step 6) after realising `motion-reduce:hover:shadow-none` would have deleted the pill's body on hover for reduced-motion users. Verified live: 3 inset + 2 outer computed layers, `backdrop-filter: blur(8px) saturate(1.7)`, forced `:hover` → `0 0 0 3px #fff, 0 0 0 4px #0d0c12`, forced `:focus-visible` → `…5px…`, and under `prefers-reduced-motion: reduce` the hover state keeps the lift instead of clearing it.
- 2026-09-14: Created for the hero base-URL card. White tint + bright inset rim read "so bright/saturated" with an unwanted white outline → re-tuned to a dark tint (restrained) → that read "a bit dark" → final state is **fully transparent** (`background: transparent`, `backdrop-filter: none`, drop shadow only). Only the shadow was consistently liked. Ladder + pitfalls above capture all three iterations.
- 2026-09-15: The same surface was reused for the much smaller **44px base-URL pill** that pairs with the `Get API Key` button. The only change to the class was rescaling the shadow for the new size — `0 22px 50px -22px rgba(72,0,0,0.55)` + `0 3px 9px -3px rgba(72,0,0,0.3)` → `0 8px 18px -10px rgba(72,0,0,0.5)` + `0 2px 5px -2px rgba(72,0,0,0.26)`; tint, layer count and full transparency were all kept. Verified computed `rgba(0,0,0,0)` bg / `backdrop-filter: none` / 2 outer drops / 0 `inset` at 1920/375/320 with no overflow.
- 2026-09-15 (2): The user then asked for the `Get API Key` CTA to be **the exact same pill** as the base URL, so this class is now the shared surface for *both* hero controls (`page.tsx` puts it directly on the `<Link>`). That immediately broke the CTA's interactions and produced the biggest lesson in this file: the class was **unlayered**, and unlayered CSS beats layered CSS regardless of specificity, so `hover:bg-white/15` and `focus-visible:shadow-[…]` were both dead on the link — confirmed with `CSS.forcePseudoState` (forced `:hover` left `background-color` at `rgba(0,0,0,0)`; forced `:focus-visible` produced no ring). Moving the rule into `@layer components` fixed both while leaving the resting state pixel-identical (`rgba(0,0,0,0)` / `backdrop-filter: none` / same shadow on both pills). Never diagnose this by eye — a missing focus ring is invisible until you tab to it.
