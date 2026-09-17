---
name: vertical-cut-reveal
description: Use when adding or debugging the hero mark's pop-in (or any vertical-cut text reveal). Covers the char split, the center stagger, and the em-based clip-window trick that keeps a tight leading without clipping glyph ink — plus the hand-off that gives the slot to the depth flip.
created: 2026-09-14
updated: 2026-09-15
tags: [frontend, motion, animation, typography, hero, accessibility]
---

# VerticalCutReveal

Text climbs up through an invisible cut and pops into place. Each **word** is an
`overflow-hidden` clip window; each **glyph** starts at `y: 100%` (below the window's
bottom edge) and springs to `y: 0`. `staggerFrom="center"` fans the wave out from the
middle character. A spring with a little overshoot reads as the pop.

Adapted from Cnippet's `VerticalCutReveal` (MIT). Mechanic theirs, implementation ours.

## When to Use

- The `luv13` hero mark (replaced the glyph-scramble `DecryptText` on 2026-09-14). Since 2026-09-15 it is **act 1 only** — the pop, which then hands its slot to `depth-flip-text.md` for act 2.
- Any short display line that should pop up on mount.
- **Don't use when:** the line is long body copy (one DOM node per grapheme), the copy is
  user data, or the text must be selectable mid-animation. For a scramble, see the
  archived `.cursor/skills/archive/decrypt-text.md` instead.

## Files

- Component: `web/components/ui/vertical-cut-reveal.tsx`
- Hero usage: `web/components/marketing/hero-title.tsx` — **not `page.tsx` directly**
  (that snippet below is history; the page renders `<HeroTitle />`).

## Props

| Prop | Meaning |
| --- | --- |
| `children` | The string to reveal. |
| `splitBy` | `"words"` (default) \| `"characters"` \| `"lines"` \| any delimiter string. |
| `staggerDuration` | Seconds between segments. Hero uses `0.04`. |
| `staggerFrom` | `"first"` \| `"last"` \| `"center"` \| `"random"` \| number. Hero uses `"center"`. |
| `transition` | Motion transition per segment. Hero uses `{ type: "spring", stiffness: 300, damping: 20 }`. |
| `reverse` | Slide down from above instead of up from below. |
| `containerClassName` / `wordLevelClassName` / `elementLevelClassName` / `className` | Classes on the root, each word's clip window, each char wrapper, and the root again. |

Word boundaries are always preserved — characters never wrap mid-word.

## Hero usage (stale snippet — kept for the class pairing)

```tsx
// HISTORY. This is what page.tsx looked like before 2026-09-15; the size ladder
// now lives on the HeroTitle wrapper and this markup lives in hero-title.tsx as
// act 1, with the flip as act 2. Do not paste this back into page.tsx.
<h1 className="text-center font-sans text-[5.625rem] leading-[0.9] tracking-tight text-paper md:text-[9rem] lg:text-[12rem]">
  <VerticalCutReveal
    splitBy="characters"
    staggerDuration={0.04}
    staggerFrom="center"
    transition={{ type: "spring", stiffness: 300, damping: 20 }}
    containerClassName="justify-center leading-[1.2] -my-[0.15em]"
  >
    luv13
  </VerticalCutReveal>
</h1>
```

The **one** thing worth carrying forward from it is the pairing
`leading-[1.2] -my-[0.15em]` plus `justify-center` — the tight-leading trick below.

## Hand-off to the flip (`hero-title.tsx`)

`HeroTitle` renders act 1, then swaps to `DepthFlipText` on the reveal's
`onComplete`:

```tsx
const [revealed, setRevealed] = useState(false);

<div className={`text-center font-sans text-paper ${HERO_MARK_SIZE}`}>
  {revealed ? (
    <DepthFlipText phrases={PHRASES} loop />
  ) : (
    <h1 className="leading-[0.9] tracking-tight">
      <VerticalCutReveal … onComplete={() => setRevealed(true)}>
        luv13
      </VerticalCutReveal>
    </h1>
  )}
</div>
```

Two rules make this safe, and both were measured rather than assumed:
- **The two acts must agree on geometry.** The pop's clip window is `1.2em` tall
  centred on a `0.9em` flow line (the `-my-[0.15em]` trick); the flip's slot is
  `h-[0.9em]` with `1.2em` faces centred in it. That is why the hand-off moves
  nothing — same ink box, same flow height. Change one and you must change the
  other.
- **The size ladder belongs on the wrapper**, in `em` terms, because the flip
  slot's height is `0.9em` of the *caller's* type scale. `HERO_MARK_SIZE` is the
  single source: `text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem]`.

Never mount both acts at once. Motion writes `transform` on the chars and GSAP
writes `transform` on the same chars — two systems on one element fight over the
inline style. Sequential mounting is the contract, not a nicety. The flip then
runs `loop` (mark ⇄ quote, ~9.7s a cycle) and pauses itself while the hero is off
screen, so the pop is the only thing that ever happens exactly once.

## The tight-leading trick (read before changing the hero classes)

The clip window must be **taller than the glyph ink** or the mark is permanently chopped —
`overflow: hidden` clips painted ink, and the hero's `leading-[0.9]` is *smaller* than the
font's ascent+descent (~1.19em for HelveticaNeue-Bold). So give the clip window a roomy
line-height and pull its extra height back out of the flow with a negative margin.

Keep them paired: `leading-[W] -my-[m]` with **`m = (0.9 − W) / 2`** (em units).

- `W` sets the cut: window height = `W × font-size`. Bigger `W` = looser cut.
- `m` cancels the extra half-leading at top and bottom, so the flow height stays `0.9em`
  and the baseline is **identical for any `W`** (the margin collapses through the `h1`).
  Verified at 192px font: baseline `374.903px` before and after the swap at 1920px wide.
  The *invariant* (baseline and flow height unchanged) is what matters; it holds at the
  current 88px ladder too, and the flip's `h-[0.9em]` slot depends on it.
- Current pairing: `leading-[1.2] -my-[0.15em]` (window `1.2 ×` font-size).

Overshoot headroom, if you retune `W` or the spring: a spring with damping `c` and
stiffness `k` overshoots by `exp(−ζπ / √(1−ζ²))` where `ζ = c / (2√k)`. For `c=20, k=300`
that is ~10.9% of the travel (`= W × font-size`). The ink needs
`(W − inkHeight)/2 − overshoot > 0` of clearance at the top. At `W=1.2` the hero clears by
~25px at 192px font.

## Pitfalls

- **Do not remove the negative margin.** Without it the `h1` grows and the mark drops
  ~50px at desktop. Do not set `W = 0.9` to "simplify" either — that clips the glyphs.
- **SSR renders the mark hidden** (`style="transform:translateY(100%)"`) and Motion
  animates it in on hydration. The readable string lives in an `sr-only` sibling and the
  glyph layer is `aria-hidden`, so crawlers/screen readers still get `luv13`. Don't move
  the `sr-only` span or the `<h1>` loses its text.
- **No `setState` in an effect body.** The reveal is driven purely by Motion's
  `initial`/`animate`, not an `isAnimating` flag + mount effect (the reference component did
  that; it trips the repo's `react-hooks/set-state-in-effect` rule). Keep it declarative.
- **`onComplete` is for the hand-off, not for state you render *inside* the reveal.** Since
  2026-09-15 the hero passes `onComplete={() => setRevealed(true)}`, which unmounts the
  reveal and mounts `DepthFlipText` in its place — that is a parent swap, and it is the one
  legitimate use. Do not use `onComplete` to flip a "now I'm done animating" class on the
  reveal itself: the swap would re-render mid-timeline.
- **Do not paste this reveal back into `page.tsx`.** The `<h1><VerticalCutReveal>` snippet
  above used to *be* the hero title, and it was reused as "the hero snippet" for months
  after `hero-title.tsx` took over. The hero title is `<HeroTitle />` now and the pop is
  only act 1 — see `depth-flip-text.md` for act 2.
- **No mutable counter across `.map()`.** `react-hooks/immutability` rejects
  `let flatIndex; words.map(() => flatIndex += 1)`. Precompute per-word start indices in a
  `useMemo` (`wordStarts`) and add `charIndex`.
- **`prefers-reduced-motion` must be instant.** `useReducedMotion()` zeroes the stagger
  delay **and** swaps the transition to `{ duration: 0 }`; zeroing only the delay leaves a
  slow spring. Verified: all glyphs at `transform: none` immediately.
- **`cn`/tailwind-merge order.** `className` then `containerClassName` are merged last, so
  `containerClassName` wins — that is where the hero's `justify-center leading-[…] -my-[…]`
  lives. `cn` handles conflicting utilities fine (`leading-[1.2]` overrides the inherited
  value, not the `h1`'s class).
- The root is `display: flex`, i.e. block-level. Inside a `text-center` heading you must
  pass `justify-center` or a single word sits left.
- **The `h1`'s own box is taller than its flow contribution — that is not a bug.** The
  root's `-my-[0.15em]` margins collapse *through* the `h1`, so
  `h1.getBoundingClientRect().height` reads `230.4px` (the clip window) and the `h1` sits
  `28.8px` above the section's content top, while its flow height is still `172.8px`.
  Don't "fix" this by measuring the `h1`. The invariant is the **section** height:
  `pt + 0.9em + pb` — desktop 192px font `216 + 172.8 + 40 = 428.8`; 375px `96 + 81 + 32 = 209`.

## Verification

- [ ] `npm run typecheck`, `npx eslint` on the touched files, `npm test`, `npm run build`
      (exit 0) all pass.
- [ ] SSR HTML shows each glyph at `transform:translateY(100%)` and one `sr-only` `luv13`:
      `curl -s localhost:3000/ | grep -o '<h1[^>]*>.*</h1>'`.
- [ ] At rest `transform` is `none` (or `matrix(...,0,...)`) on every glyph.
- [ ] Every glyph is the topmost element at its own centre — a capture-free proxy for
      "laid out and painted here". Per glyph span:
      `document.elementFromPoint(rect.left + rect.width / 2, rect.top + 100)` must return
      that same span. Check `1` and `3` specifically: if the cut ever clipped them they
      would not be hit-testable at their own advance boxes.
- [ ] Flow height unchanged: section height `= pt + 0.9em + pb` (see Pitfalls).
- [ ] Glyph ink clears the clip window at rest and at the spring's overshoot peak:
      measure `clip.getBoundingClientRect()` vs a canvas `measureText` ink box.

**Do not verify this with screenshots.** In this project's embedded webview, both
`Page.captureScreenshot` and `browser_take_screenshot` returned composites that were
internally impossible: a second `luv13` copy at `x≈1273` with no DOM node behind it, a seam
at `x≈767` where the frame changed mid-image, and a 1668×1784 PNG whose red band was 4×
too tall (real viewport 1440/1920 at `devicePixelRatio: 2`). Every "missing glyph" traced
back to a capture artifact — the DOM held all five glyphs at correct advances throughout.
Assert geometry from the DOM (`getBoundingClientRect`, `elementFromPoint`, computed style)
and ink from `measureText`; show the user a screenshot, but never pass/fail on its pixels.
- [ ] The mark's baseline matches the pre-swap value at 375 / 768 / 1440 / 1920.
- [ ] With `prefers-reduced-motion: reduce`, all glyphs are at `transform: none` on the
      first frame and nothing staggers.

## Usage

- count: 3
- 2026-09-15: **Act 1 of two.** The mark's pop stayed when the flip was added, because the
  flip does not replace it — it inherits the slot the pop vacates. `page.tsx`'s
  `<h1><VerticalCutReveal>` became `<HeroTitle />`; `hero-title.tsx` owns the sequence
  (`onComplete` → unmount → `DepthFlipText`) and the size ladder. The clip pairing
  `leading-[1.2] -my-[0.15em]` is now load-bearing for *both* acts: it is what makes the
  pop's `1.2em` window and the flip's `0.9em` slot agree on ink box and flow height, which
  is why the hand-off moves nothing. Measured across the hand-off at 375 and 1920:
  `glyphTop`, `glyphH`, `h1Top`, `rowTop`, `heroH`, `docH` identical frame-to-frame.
  Full numbers in `depth-flip-text.md` / `AGENT_MEMORY.md`.
- 2026-09-14: Created. Replaced the hero `luv13` glyph-scramble with the pop reveal at the
  user's request; `DecryptText` and its CSS were deleted and the skill archived.
- 2026-09-14: Verified at 375 and 1920 — all five glyphs (`l`,`u`,`v`,`1`,`3`) hit-testable
  at their own advance boxes, mark centred on the viewport, section height exactly
  `pt + 0.9em + pb` (209 / 428.8), `documentElement.scrollWidth` == viewport width. The
  screenshot path was unusable and is documented in Verification.
