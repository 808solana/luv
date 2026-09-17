---
name: depth-flip-text
description: Use when text should flip away through a 3D hinge to reveal the next line (the hero title's `luv13` → Virgil Abloh hand-off, looping while it is on screen). Covers the char hinge, the fixed-height slot, the inline attribution, and the keyed current/next layers.
created: 2026-09-15
updated: 2026-09-15
tags: [frontend, motion, animation, typography, hero, gsap, accessibility]
---

# DepthFlipText

A line of text tumbles away through a 3D hinge and the next line tumbles in
behind it. Every character rotates about an axis **half a line box behind the
glyph**, so at `rotationX: 0` the transform resolves to plain identity: both
faces start and end exactly on their own layout box, and the page does not shift
by a pixel while the flip runs.

Adapted from Hyperiux Vault's `DepthFlipText` demo (mechanic theirs,
implementation ours). This file is the record of what was deliberately *not*
copied and why.

## When to Use

- A short display line that should hand off to another short line — the hero
  `luv13` → *“Anyone who has a will to create is an artist” — Virgil Abloh* — and
  then keep trading places while it is on screen.
- Any slot where two or more phrases differ a lot in size and must not move the
  layout around them.
- **Don't use when:** the text is long body copy (one DOM node per grapheme), it
  is user data, or it must be selectable mid-flip. For a single one-shot rise,
  use `vertical-cut-reveal.md`; for a scramble, `archive/decrypt-text.md`.

## Files

- Component: `web/components/ui/depth-flip-text.tsx` (client, GSAP).
- Composer: `web/components/marketing/hero-title.tsx` — pop act + flip act, and the
  `loop` prop lives here.
- Hero usage: `web/app/page.tsx` (`#hero`), `<HeroTitle />`.

## Props

| Prop | Meaning |
| --- | --- |
| `phrases` | `DepthFlipPhrase[]`: `{ text, aside?, as?, className?, hold? }`. Order matters. |
| `phrases[].as` | Tag for that phrase. The wordmark is `"h1"`, the quote `"p"`. |
| `phrases[].aside` | Shorter fragment **to the right** of the text at `0.55em` / `tracking-widest` / `opacity-80`, prefixed with an em dash (`— Virgil Abloh`). Flips with the line. |
| `phrases[].hold` | Seconds **this** phrase sits still before flipping on. Default 3. |
| `phrases[].className` | Type scale / tracking / colour for that phrase's own line. |
| `transitionDuration` | Seconds one character takes through the cut. Hero 1.15. |
| `charStagger` | Seconds between characters. Hero 0.012. |
| `loop` | Keep cycling instead of resting on the first phrase. Default `false`; **the hero turns it on**. |
| `className` | Extra slot utilities. Height default is `h-[0.9em]` (see below). |

## Steps

1. **Split in React, not with `SplitText`.** Words become `inline-block` spans
   (so a word can never break mid-word) and each grapheme a
   `[data-flip-char]` `inline-block` span. `Intl.Segmenter` keeps emoji and
   combining marks intact and is deterministic on the server. The payoff: the
   text is in the SSR HTML, there is no fonts-ready gate, and there is no
   split/revert churn between cycles.
2. **Give the slot a fixed height.** `h-[0.9em]` by default — i.e. "the caller's
   own type scale, one line at 0.9 leading". Both faces are
   `absolute inset-0 flex items-center justify-center`, so the slot's height is
   the whole contract with the page: with the phrases at 88px and 32px, an auto
   height would shove the CTAs under the title on every flip.
3. **Key the layers by role, not by phrase** — `current-${i}` / `next-${j}`. A
   fresh pair re-mounts each cycle, which is what (a) keeps the incoming face
   `opacity-0` until GSAP turns it (the SSR-safe hidden state), and (b) keeps the
   resting face free of the previous cycle's inline transforms. React remounting
   is doing the cleanup; `revertOnUpdate: true` on `useGSAP` is the belt.
4. **Hinge each char behind the glyph**: `transformOrigin: 50% 50% ${-(char.offsetHeight / 2)}px`,
   `transformPerspective: 1200`, `backfaceVisibility: hidden`, `force3D: true`.
   Measure **per char** (the attribution is 0.55em of the quote, so a single
   shared offset is wrong there), and in **px** — GSAP reads the z-origin with a
   bare `parseFloat`.
5. **Timeline:** `gsap.timeline({ delay: phrase.hold, onComplete: advance })`
   with `.to(currentChars, { rotationX: 90 }, 0)` and
   `.to(nextChars, { rotationX: 0 }, 0)`, both `power4.inOut`, both
   `stagger: charStagger`. The incoming face is set to `rotationX: -90` up front.
   At the end of the timeline the incoming chars are at identity, so `advance()`
   can swap the roles invisibly. Run every cycle through one small `run(build)`
   helper that records the timeline in a ref and pauses it if the slot is
   currently off screen.
6. **Finish deliberately, or don't finish at all.** `advance` wraps to `0` and,
   when `!loop`, sets `finished` so no further timeline runs — the wordmark rests
   for the life of the page. With `loop` on (the hero) it just keeps cycling:
   mark → quote → mark → …, and the cycle is paused whenever the slot leaves the
   viewport, so a looping hero never animates to an empty room.
7. **The attribution rides the text, not a line of its own.** Render a real space
   followed by `inline-block whitespace-nowrap text-[0.55em] tracking-widest
   opacity-80`, and draw the em dash in the component. The space is the break
   opportunity *and* what keeps `innerText` / copy identical to the `sr-only`
   string; `nowrap` keeps `— Virgil Abloh` together, so it either trails the text
   on one baseline or drops to the next line whole. `data-flip-aside` is the hook
   the layout probes use.
   **`tracking-widest` is load-bearing, not decoration** — the phrase inherits the
   hero wrapper's `tracking-tight`, which is computed on the *88px* wrapper
   (`-2.2px`) and inherits as a **length**, i.e. `-0.125em` on a `17.6px`
   attribution. That cascade is why the name read as jammed. The aside is the one
   place in the hero set open.
   **A space inside the phrase must be a `\u00A0`.** The quote's closing `”` is set
   off by a no-break space so it cannot become a line-break point (a plain space
   there lets `”` land alone at the end of a line).
8. **Don't put `text-balance` / `text-pretty` on a phrase with an `aside`.** Both
   would rather pull a word down from the sentence than let the inline-block atom
   finish the last line, so a sentence that *fits* on one line gets split anyway
   (`… is an artist ”` + `— Virgil Abloh` glued to its tail). Plain greedy wrapping
   gives the shape you want: the sentence whole, the attribution on the next
   centred line.
9. **Pause honestly.** Store each cycle's timeline in a ref, pause it from an
   `IntersectionObserver` on the slot, and guard the resume with
   `progress() < 1` so a *completed* timeline can never be `play()`ed back on top
   of the next cycle. A cycle created while off screen starts paused.
10. **`prefers-reduced-motion` is an opacity crossfade**: no rotation, no
    per-char stagger, same holds (see the `Reduced motion` section).
11. **A11y:** inside each phrase, an `sr-only` plain-text line (including the
    attribution) plus an `aria-hidden` glyph container. The accessible name of
    the `h1` is therefore always `luv13`, even while the mark is the hidden face.

## Reduced motion

`window.matchMedia("(prefers-reduced-motion: reduce)")` is read **inside the
effect** (so each cycle picks up the current preference) and takes a short
branch: `gsap.set(nextChars, {opacity: 0})`
then a 0.5s crossfade of `currentChars` → 0 / `nextChars` → 1, with the same
`hold`. No `rotationX` is ever set on that path, so `transform` stays `none`
throughout. It still loops, and still pauses off screen. Measured: transitions
every 2.4s (mark) / 4.8s (quote), `transformCount: 1` (`none`) across a 21s run.

## Pitfalls

- **Opacity below 1 on a *layer* flattens its 3D children.** The crossfade and
  any hiding must ride on the characters; the layer gets `opacity: 1` set once at
  the top of the effect (overriding the incoming layer's `opacity-0` class) and
  nothing else. `opacity: 1` (exactly) does not create a stacking context, so
  this is safe — `0.99` would not be.
- **`tracking-*` inherits as a computed length, not as an em factor.** The hero
  wrapper carries `tracking-tight` at its own `88px`, so it hands down `-2.2px` to
  everything inside it: `-0.069em` on the `32px` quote, and a punishing `-0.125em`
  on the `17.6px` attribution. The aside re-declares its own (`tracking-widest`),
  and **any other small text added inside the hero must re-declare its tracking
  too** — do not read the wrapper's `-0.025em` in the source and assume that is
  what children are getting.
- **Don't let a phrase's size reach the slot.** The slot is fixed, so a phrase
  that is too tall overflows *visually* (no clip) into the gap below. Check
  `slotTop`/`slotBottom` against the measured union of the phrase's word rects
  whenever you change the type ladder — it is the pill gap that pays. (One line
  of quote + attribution is 41.6px inside the 79.2px slot at `lg`; the wrapped
  two-line form at 320 is also 41.6px, so it stays inside the 50.4px slot there.)
- **The separator before the attribution must be a real space, not a margin.**
  `ml-[0.35em]` measures the same and *copies worse*: `innerText` then reads
  `” — Virgil Abloh` with no space, so selecting the quote gives you a missing
  space and the visible text no longer matches the `sr-only` text. It also costs
  the wrap a place to break. Use `{" "}`.
- **The attribution's size and tracking are a pair, and they decide the wrap
  points.** Measured (2026-09-15 (3), after `tracking-widest`): the one-line form
  needs ≈404px of viewport, so **375 and 390 show two lines** — the sentence whole
  on line 1, `— Virgil Abloh` centred beneath it — while 414, 640, 768, 1024, 1440
  and 1920 are one line with the line centred exactly on `innerWidth / 2`. Below
  ≈338px the sentence itself has to wrap and the attribution legitimately trails
  its last line (320: line 1 `236.73px`, line 2 = `artist ” — Virgil Abloh`).
  Every one of those forms is 39.72–41.59px tall inside the 50.4px base slot, so
  none of them overflows. If you touch the attribution size, its tracking, the
  sentence's `text-base`, the `\u00A0`, or `px-6` on the hero section, re-measure
  320 / 375 / 390 / 404 / 414 / 640 / 1440.
- **The `progress() < 1` guard on resume is load-bearing.** `play()`ing a
  *completed* timeline restarts it, which would put a finished flip back on top of
  the live cycle and leave two timelines writing `transform` on the same chars.
- **Both GSAP and `IntersectionObserver` need the page to be rendering.** In this
  webview the tab gets occluded/throttled and then rAF stops (measured: **1 frame
  per 800ms**), which freezes GSAP *and* silently drops every IO callback — so a
  paused flip looks exactly like a broken resume, and a fresh observer you attach
  to diagnose it records *no events at all*. Always count rAF frames
  (`requestAnimationFrame` ×N over 1s ≈ 60) inside the same probe before believing
  a pause/resume result, and reload the page to restore rendering.
- **Don't verify the loop with one long sample.** Sample the current layer's tag
  (`slot.children[0].firstElementChild.tagName` → `H1` / `P`) every 150ms and
  report the transitions with timestamps; the expected cadence is 3.5s and 6.1s.
- **Don't switch to `SplitText` "because the docs do".** It re-splits and reverts
  the DOM every cycle, needs a fonts-ready gate or it measures a fallback face,
  and it puts the text behind JS. The React split is boring and it wins.
- **Don't add `ScrollTrigger`/scrub, and don't wrap the component in a section.**
  It is a text slot: it takes the size it is given, and the caller owns the
  background, the padding and the surrounding controls.
- **Dependencies must include the phrase identity**, not just `activeIndex` — a
  caller that swaps the text with the same index would otherwise keep the old
  timeline.
- `transformOrigin` function-values work in `gsap.set`, but a per-char `forEach`
  is easier to read and to reason about when the face has two different type
  sizes in it. Keep the `forEach`.
- The `[data-flip-char]` attribute is the *only* contract between the markup and
  the timeline. If you change the split, keep the attribute.

## Verification

- [ ] **The hand-off moves nothing.** Probe `getBoundingClientRect().top` for the
      first glyph of the mark, the `h1`, the control row under it, the section
      and `document.documentElement.scrollHeight` across the pop and across the flip: the
      last pop frame and the first flip frame must be identical. Reference
      numbers (2026-09-15): 375 → `glyphTop 87.6, glyphH 67.2, h1Top 87.6,
      rowTop 177.4, heroH 253.4, docH 2391`; 1920 → `202.8 / 105.59 / 334.2 /
      418.2 / 3258`. The quote phase must report the same four: 375 →
      `rowTop 177.4, heroH 253.4, docH 2391`; 1920 → `334.2 / 418.2 / 3258`.
- [ ] `rowTop`, `heroH`, `docH` and `scrollWidth` are **single-valued** for the
      whole run — no sample differs, at any width.
- [ ] The flip actually plays: the first char's `matrix3d` angle walks
      `0 → ±90` and back, and the incoming phrase's chars leave `-90 → 0`.
- [ ] **With `loop`, the cycle repeats**: the layer tag alternates `P` → `H1` →
      `P` on a 3.5s / 6.1s cadence (measured 20s: `P 120ms → H1 5881 → P 9361 →
      H1 15482 → P 19081`).
- [ ] **Paused off screen**: scrolling the hero out of view must produce *zero*
      tag transitions over ≥12s, and scrolling back must resume within one
      hold+flip (`H1` at 1500ms, `P` at 4951ms in the reference run). Count rAF
      frames in the same probe — 500+/window — or the result means nothing.
- [ ] Under `prefers-reduced-motion` (via `Emulation.setEmulatedMedia`): every
      char's computed `transform` is `none` throughout, the crossfade still runs,
      and the cycle still loops.
- [ ] The quote line is centred and the attribution is where it belongs. Measure
      the `[data-flip-aside]` span and the sentence's own chars, not `innerText`.
      2026-09-15 (3): **one line at 414 / 640 / 768 / 1024 / 1440 / 1920** with
      `line.r - line.l` centred exactly on `innerWidth / 2` (1440: sentence
      `587.69`, aside `142.93`, line centre `720.00`; 640: `452.54` / `107.20`,
      centre `320.00`); **two centred lines at 375 / 390** (sentence `279.87` whole
      on line 1, aside `71.49` on line 2, both centred, content `39.72px` inside
      the `50.4px` slot); **three-line-ish at 320**, where the sentence wraps and
      the aside trails its last line (content `41.59px`).
- [ ] The attribution is **openly tracked, not inherited-tight**: its computed
      `letter-spacing` is `0.1em` of its own size (`1.76px` at the `lg` `17.6px`),
      *not* the `-2.2px` the `tracking-tight` hero wrapper hands down.
- [ ] `innerText` of the quote equals the `sr-only` string character for
      character — same curly quotes, same em dash, **same space before it** — and
      the no-break space is intact (compare `.textContent.charCodeAt()` at the
      closing quote; a plain `0x20` there is a regression).
- [ ] **The gap before the closing quote is a real space-width gap.** Measure the
      no-break-space char span: `6.71px` at the `lg` `32px` quote (an `8.9px`
      space less the inherited `-2.2px` tracking). It must not be zero, and it must
      not be a break opportunity.
- [ ] The `h1`'s accessible name stays `luv13` **while the quote is on screen**
      (the AX snapshot shows `heading level=1 "luv13"` plus a text node with the
      full quote), with the glyph containers `aria-hidden`.
- [ ] `prettier` / `tsc --noEmit` / `eslint` / `npm test` / `npm run build` all 0.

**Do not verify layout from screenshots in this webview** (see
`vertical-cut-reveal.md`); use them to show the user, never to pass/fail.

## Probing tip

To capture a time series from the *first* frame after a reload, register a probe
with `Page.addScriptToEvaluateOnNewDocument` — and call **`Page.enable` first**,
or the registration silently no-ops (`window.__probe` reads `undefined` on a page
that is working perfectly). Sample ~40ms and record `t, n = [data-flip-char]
count, h1 rect, glyph rect, row rect, heroH, docH`; a boot probe is the only way
to see the pop state, because the flip mounts within ~0.4s of hydration.

## Usage

- count: 3
- 2026-09-15 (3): **Two typographic fixes to the aside.** The user:
  *"in the quotes, the T and the quote are also kind of close together. Can you go ahead and
  add just a little bit of a space, like a space button … between the T and the quote? Also,
  with Virgil Abloh … all the letters are really close together. Is there anywhere you can
  space out the letters?"* So: (1) the phrase text is now
  `“Anyone who has a will to create is an artist\u00A0”` — a **no-break** space, so the gap
  reads as a space bar but the closing `”` can never land alone at the end of a line
  (`6.71px` at the `lg` `32px` quote); (2) the aside span gained `tracking-widest`, which is a
  **+0.125em swing** from the `tracking-tight` it was inheriting — the root cause, since
  `tracking-tight` computes to `-2.2px` on the *88px* hero wrapper and letter-spacing
  inherits as a **length**, i.e. `-0.125em` at the attribution's `17.6px`, which is why the
  name looked jammed. Also removed `text-balance` from the quote phrase: with an inline-block
  aside, balance/pretty pull a word down rather than let the atom finish the line, splitting a
  sentence that fits (375 showed `… is an artist ”` + `— Virgil Abloh` glued to its tail);
  greedy wrapping gives the intended shape. The line is therefore one line at
  **414 / 640 / 768 / 1024 / 1440 / 1920** (centred exactly: 1440 line centre `720.00`), two
  centred lines at **375 / 390** (sentence `279.87` / aside `71.49`), and at 320 the sentence
  wraps with the aside trailing its last line — content 39.72–41.59px inside the 50.4px base
  slot in every case. `rowTop`/`heroH`/`docH` byte-identical to baseline
  (375: `177.4 / 253.4 / 2391`; 1440 and 1920: `334.2 / 418.2 / 3258`), `scrollWidth` never
  exceeded the viewport, and the 16s loop sample still alternated `P→H1→P` at 3.5s/6.1s with
  963 rAF frames.
- 2026-09-15 (2): **Three tweaks: quotes, attribution to the right, and loop.** *(Superseded the same day by (3): the 0.55em/one-line-at-375 numbers below are pre-`tracking-widest` — the current wrap points are in Steps 7–8 and Verification.)* The user:
  *"Add quotes around the sentence. … The Virgil [Abloh]: instead of putting it on the bottom
  as a subtext, go ahead and just put it on the right of the actual text. … can you also loop
  this so that it always is happening when the user is on the hero section?"* So: (1) the
  phrase text is now `“Anyone who has a will to create is an artist”` in curly quotes; (2) the
  `sub` prop became **`aside`**, rendered inline as `{" "}` + `inline-block whitespace-nowrap
  text-[0.55em] opacity-80` with the em dash drawn by the component — a real space (not a
  margin) so `innerText` and copy match the `sr-only` string, `nowrap` so the attribution
  drops to the next line whole, and 0.55em (not 0.6) because at 0.6em the one-line form fits
  375px by exactly one pixel; (3) `loop` is **on**, and every cycle now runs through a
  `run(build)` helper that records its timeline in a ref so an `IntersectionObserver` on the
  slot can pause it off screen — resume is guarded by `progress() < 1` so a completed timeline
  can never be `play()`ed back on top of the next one. Verified with an rAF-counting probe:
  loop transitions `P→H1→P` at 3.5s/6.1s, **zero transitions in 12s while scrolled away**
  (with 721 frames rendered in that window, i.e. genuinely paused rather than frozen), resume
  at 1500ms after returning; reduced motion loops too with `transformCount: 1` (`none`). One
  line at 375/390/414/640/768/1024/1440/1920, two balanced centred lines at 320/360, no
  horizontal overflow anywhere, `rowTop`/`heroH`/`docH` byte-identical to the pre-change
  baseline at 375 (`177.4 / 253.4 / 2391`) and 1920 (`334.2 / 418.2 / 3258`). Learned the hard
  way: a throttled webview tab stops rAF (**1 frame per 800ms**) and that freezes GSAP *and*
  drops IO callbacks, which reads exactly like a broken resume — always count frames.
- 2026-09-15: Created for the hero title flip (`#hero`). Replaced the rigid
  Hyperiux install prompt's plumbing (SplitText + ScrollTrigger + `min-h-screen`
  section) with a React split and a fixed `0.9em` slot; kept the hinge mechanic
  verbatim. Verified at 320 / 375 / 1440 / 1920 plus reduced motion — see the
  Curator entry in `AGENT_MEMORY.md` for the measured numbers. `loop` defaults to
  `false` (the hero turns it on since 2026-09-15 (2)).
