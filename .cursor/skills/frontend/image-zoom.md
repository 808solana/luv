---
name: image-zoom
description: Use when a raster on the public site must open into a full-screen pan/pinch/zoom viewer (tap-to-zoom on a chart or a card), or when a zoomed raster must be stepped through a set without closing. Mount `ImageZoomOverlay`; never reach for a lightbox library.
created: 2026-09-15
updated: 2026-09-16
tags: [frontend, marketing, chart, zoom, viewer, gesture, portal, a11y]
---

# Full-screen zoom viewer for shielded rasters

## When to Use
- A raster is too small to read in place and the user asks to "tap it and zoom in"
- The Artificial Analysis chart carousel (`intelligence-carousel.tsx`) is the live consumer
- The set has **more than one raster**: pass `onPrev`/`onNext` and the viewer grows `‹ ›`, so "see the next chart" is one press instead of close → step in the carousel → zoom again
- Don't use when: the thing to enlarge is a video, a live DOM page, or an SVG; don't use a lightbox library (`react-zoom-pan-pinch`, `yet-another-react-lightbox`, …) — see Pitfall 10

## Shape
`web/components/ui/image-zoom.tsx` — one `"use client"` component. Data + `onClose` are required; the set props are optional and only draw what they enable:

```tsx
<ImageZoomOverlay
  src={slides[zoomed].src}
  alt={slides[zoomed].alt}
  ratio={SLIDE_RATIO}            // 2560 / 938 — the file's width/height
  label={`Artificial Analysis chart ${zoomed + 1} of ${count}, zoomed`}
  position={{ index: zoomed + 1, total: count }}   // the "1 / 2" chip, a role="status"
  onPrev={count > 1 ? () => stepZoom(-1) : undefined}
  onNext={count > 1 ? () => stepZoom(1) : undefined}
  onClose={() => setZoomed(null)}
/>
```

**Mounting is opening; unmounting is closing.** There is no `open` prop and no `isOpen` state inside — the parent's `zoomed` index is the only state, which is what makes "reopen starts fresh" free.

**Stepping keeps the viewer mounted, so it keeps the zoom.** The set shares one `ratio`, so `2.4×` framed on chart 1 is the same crop of chart 2 and the visitor's place in the chart survives the press — the whole point of not closing. That is a promise about the *caller's* data (`SLIDE_RATIO` is the one ratio for every slide in `intelligence-carousel.tsx`); see Pitfall 13.

It portals to `document.body` (`role="dialog"`, `aria-modal="true"`, `aria-label={label}`, `z-[100]`, `bg-ink/95`), so no `transform`, `overflow: hidden` or `z-index` on an ancestor can trap it. The raster inside is still a **`ShieldedImage`** — the viewer does not reintroduce `<img>` (see `shielded-images.md`).

## Steps
1. **Build the transform as data, not as DOM.** `view = useRef<View>({ scale, x, y })` is the truth (scale is relative to the *fit box*, so `1` = whole raster visible); `applied` state is only its rendered mirror. `apply(next)` clamps against the measured stage and writes both. Every gesture ends in one `apply` call.
2. **Measure from the stage's ref callback, not from an effect.** `attachStage(node)` stores `stageRef`, measures `clientWidth/clientHeight` and applies the opening scale in the same call, so the first paint is already at the opening scale instead of flashing the fit view. A `ResizeObserver` re-`measure`s + re-`apply`s afterwards (rotate, URL bar, keyboard).
3. **Sizing:** `fitBox()` = `width = min(stageW, stageH * ratio)`, `height = width / ratio`, anchored with `transform-origin: center center`, so the crop is symmetric and the pan clamps are simply `maxX = (width * scale - stageW) / 2`.
4. **Opening scale** = `clamp(stageH * OPEN_FILL / height, 1, 3)` with `OPEN_FILL = 0.55`: a 2.7:1 raster in a portrait stage is a thin strip at fit, so open where it is legible — but never below fit and never above 3×.
5. **Gestures** (Pointer Events, `touch-none` on the stage): 1 pointer = pan, 2 = pinch (`scale = gripScale * distance/gripDistance`, anchored on the midpoint), move past `TAP_SLOP = 8px` sets `moved`, second tap within `320ms` / `28px` = double-tap toggle (`2.6` ↔ `1`). Every zoom (pinch, wheel, double-tap, `±`) is **anchored**: `x' = anchor.x - (next/current) * (anchor.x - x)`.
6. **Fit** is `apply({ scale: 1, x: 0, y: 0 })` — by definition. The `Fit` control renders only while `applied.scale > 1`, next to `−`, the `%` readout and `+`; `0` is its keyboard twin.
7. **Keyboard:** `Escape` closes, `+`/`=`/`−`/`_`/`0` zoom, arrows pan **only** when zoomed, and `Tab` is trapped between the dialog's focusables; the close button takes focus on mount and `previousFocus` gets it back on unmount.
8. **Lock the page behind:** `root.style.overflow = body.style.overflow = "hidden"` plus `body.paddingRight = (innerWidth - root.clientWidth)px` to pay back the scrollbar gutter, restored in the cleanup. `data-lenis-prevent` on the dialog keeps Lenis off the overlay — **the attribute is the load-bearing part**, because Lenis scrolls by calling `window.scrollTo`, which ignores `overflow: hidden`; without it, a wheel over the dialog's header (anywhere outside the stage) still runs the page behind. Do **not** prove the lock with `window.scrollBy()` in a probe: programmatic scrolling is allowed on a non-scrollable root and the page moves, which looks exactly like a broken lock. Dispatch a `wheel` at the dialog's header instead, and check the same wheel scrolls the page again after closing.
9. **Wire a carousel trigger** as a `<button>` *sibling on top of* the slide (the slide's `ShieldedImage` is `pointer-events-none`), and gate it on the press having travelled less than `TAP_SLOP` so a sweep steps the carousel instead of opening the viewer. Bring the open index into the parent's autoplay condition (`zoomed !== null` → don't advance).
10. **Stepping a set is three props, not a mode.** `onPrev`/`onNext` render floating `‹ ›` (44px `bg-paper/85 backdrop-blur-sm` pills, `pointer-events-none` on their row / `auto` on the buttons) and `position` renders the `1 / 2` chip; all three are optional, so a single-raster viewer is unchanged. The parent's stepper must move **both** its `zoomed` index and its track `index` (`setZoomed(next); setIndex(next)`) so closing the viewer leaves the visitor on the chart they were reading, and it should wrap like the carousel's own `goTo` does. At fit the horizontal arrow keys step (there is nothing to pan); zoomed they keep panning — and the buttons stay `Tab`-reachable at any scale, so `Enter` on a focused arrow steps again.

## Pitfalls
1. **Never read `view.current` during render.** `useState(view.current)` trips `react-hooks/refs` ("Cannot access refs during render"). Seed the mirror with a literal (`{ scale: MIN_SCALE, x: 0, y: 0 }`) — `attachStage` corrects it during the commit.
2. **Don't call `apply` from a `useLayoutEffect`.** `setState` synchronously inside an effect trips `react-hooks/set-state-in-effect` (cascading renders). The first measurement belongs to the ref callback (step 2); the `ResizeObserver` is fine because it is not synchronous.
3. **Exactly one `measure`.** Two same-named `useCallback`s are a hard compile error (`the name \`measure\` is defined multiple times`) and — worse — Next keeps serving `000` on `/` afterwards. Always re-check `curl -o /dev/null -w '%{http_code}' http://localhost:3000/` after an edit, and relaunch the dev server per the `AGENT_MEMORY` rule when it goes quiet.
4. **`pointer-events-none` on the raster is what makes the tap need a button.** Dispatching on the `span` works, but a real user's finger lands on whatever paint the topmost hit-testable node puts there — put the affordance in a sibling `<button className="absolute inset-0">`, and never try to make the shielded span itself clickable (that would also give it a drag/select affordance).
5. **Dismiss-on-ground belongs in the pointer stream.** With pointer capture active, the compatibility `click` is retargeted to the capturing element, so an `onClick` on the backdrop can fire for a tap that ended on the raster (or not at all). Use `onPointerUp` (`endPointer`) + an `onRaster` ref recorded on `pointerdown`, and only close when the gesture never moved.
6. **Wheel needs a real listener:** React's `onWheel` is passive, so `preventDefault()` is ignored and the page behind scrolls. `stage.addEventListener("wheel", handler, { passive: false })`, and pass a **fresh** `stage.getBoundingClientRect()` into the client→stage-centre conversion — `rect.current` is only the gesture-start rect.
7. **`setPointerCapture` can throw** on a synthetic or already-released pointer; wrap it in `try…catch` so the rest of the handler still runs.
8. **A pan must clear the pending tap** (`lastTap.current = null` once `moved` flips) or a drag followed by a tap reads as a double-tap and jumps the zoom.
9. **`Fit` must not mean "back to the opening scale".** Resetting to `openScale()` leaves the chart cropped while the readout says `100%` — the fit box *is* scale 1.
10. **Don't add a zoom library.** The whole feature is ~500 lines of Pointer Events and it needs three things a lightbox won't give you: a CSS-background raster (no `<img>`), a per-viewport opening scale for a 2.7:1 file, and integration with the carousel's own drag/autoplay.
11. **Don't assert focus return with a synthetic `.click()`.** `previousFocus` is `document.activeElement` at mount; a programmatic click never focused the trigger, so the assertion reads `BODY` and looks like a bug. Verify with a real `browser_click` (or `.focus()` first). On touch it is a non-issue: a tap doesn't focus a button, so focus is `BODY` before and after.
12. **The viewer keeps its scale for the life of the mount.** Re-rendering the parent with the *same* `zoomed` index will not remount it (and therefore will not re-apply the opening scale). In practice the trigger sits behind the modal so this cannot happen — don't "fix" it by keying on something that changes on every render.
13. **Stepping only preserves the zoom because the set shares one ratio.** `box` is state, set only by `measure` (the ref callback + the `ResizeObserver`), and the stage's own size does not change when `ratio` does — so a caller that mixed ratios in one set would keep the *old* box while the new raster's fit box differs, i.e. a wrong crop at the old scale with the old clamps. Either keep the invariant (`SLIDE_RATIO` for every slide, as the carousel documents) or remount the overlay per index — do not reach for a `useLayoutEffect` on `ratio`, that is Pitfall 2.
14. **A caller passes a fresh closure per render, so nothing may re-focus in an effect that re-runs.** `onClose={() => setZoomed(null)}` and `onPrev={() => step(-1)}` are new identities every render; the keydown effect depends on them, so it re-runs on every step — and while `previousFocus.focus(); closeRef.current?.focus()` lived in *that* effect, every press of `Next` moved focus to **Close**, so the next `Enter` closed the viewer. Focus capture/restore is its own **mount-only** effect (`[]`); the listener effect is free to re-subscribe.
15. **The steppers must be siblings of the stage, never children of it.** A `pointerdown` that bubbles into the stage enters the gesture: `moved` stays false, `onRaster` is false (the button is not inside `[data-zoom-raster]`), and `endPointer` then reads the press as a tap on the dark ground and **closes the viewer**. Keeping them in a sibling `pointer-events-none` row (buttons `pointer-events-auto`) also means no `stopPropagation` bookkeeping is needed on either `pointerdown` or `pointerup`.
16. **Put the swap fade *inside* the transformed box.** The box carries `transform` (inline, from state) and `data-zoom-raster` (the hit-test anchor); the `key={src}` + `animate-in fade-in` wrapper goes one level in, around the `ShieldedImage`, so the fade cannot fight the zoom and the tap detection keeps matching. Without the fade a step at high zoom reads as a glitch, because the whole chart is replaced under a held crop.

## Verification
Measured live (CDP, dev server on `:3000`), all four controls reachable and no horizontal page overflow at any width:

- [ ] **375** (stage 375×692): opens at **277%** (`1039×381`); `Fit` → `100%` = `375×137`, whole chart visible, zoom-out disabled and `Fit` gone; double-tap at 30%/40% of the chart → `260%` **with that point staying at 30%/46%**; double-tap again → `100%` and offset `0,0`
- [ ] **768** (768×904): opens at **177%** (`1357×497`), i.e. cropped sideways on purpose; `Fit` → `100%` = `768×281`, filling the width exactly
- [ ] **1920** (1920×960): opens at **100%** (`1920×704`, whole chart visible); wheel `-240px` at 75%/30% → `177%` with the cursor point still at 75%/30%; `+` → `150%`; zoom-out button → exactly `100%` and disabled; zoom-in button → `225%`
- [ ] Precedence: single tap on the raster changes nothing and does not close; tap on the dark ground closes; `Escape` closes; pinch (`2.77 → 5.54 → 8` capped, squeeze → `4.155`) stays open; one-finger drag pans without changing scale
- [ ] Clamps: dragging 9000px past either edge stops at `±(width * scale − stageW) / 2`, horizontally symmetric
- [ ] `document.querySelectorAll('img').length === 0` while open; `documentElement.scrollWidth === innerWidth`
- [ ] Scroll lock: `body`/`root` `overflow: hidden` (plus the gutter as `body.paddingRight` when a classic scrollbar exists, `innerWidth − root.clientWidth`) while open, restored to the previous inline values on unmount
- [ ] Wheel over the **dialog header/footer** (not the stage) does not move the page while open — `data-lenis-prevent` on the dialog is what makes Lenis ignore it; wheel over the **stage** zooms instead; and wheel **after closing** scrolls the page again (Lenis re-armed)
- [ ] Focus: dialog's close button focused on mount, `Tab` wraps inside, focus returns to the trigger (real click only — see Pitfall 11)
- [ ] Carousel: **scroll it into view first** (the autoplay is gated on `IntersectionObserver` ≥0.2, so at scroll 0 it never advances and the test proves nothing) — baseline advances in ~5.5s, parked for 6.2s while the viewer is up, advances again ~5.5s after closing
- [ ] Stepping (2026-09-16, `384×752` tab — the viewer opened at `249%` = `639 × 0.55 / 141`): a real click on `Next chart` **while zoomed** leaves the viewer open, swaps the raster (`02.png` → `01.png`), updates the chip to `2 / 2` and the dialog's name to `… chart 2 of 2, zoomed`, **keeps the transform byte-identical** (`scale 1.5527, tx −212.2, ty 66.2`, same `596 × 218` box) and **leaves focus on the button that was pressed**; the carousel behind advanced with it (`Zoom into chart 2 of 2`, thumb 2 `current`); `Escape` after that still closed and returned focus to the trigger; autoplay stayed parked for 6.5s with the viewer up
- [ ] Stepper geometry at `384`: `Previous chart` at `x 8..52`, `Next chart` at `x 332..376`, both `44px` tall and centred on the stage (`y 354..398` in a `56..695` stage), `elementFromPoint` on either centre resolves to that button (not the stage), the chip `1 / 2` sits at the stage's bottom centre and the stage has `scrollWidth === clientWidth`; the arrows do overlap the raster (~11% of its width per side at fit on a phone, ~2% at 1920) — they are `bg-paper/85 backdrop-blur-sm` for that reason, and a zoomed raster can be panned out from under them
- [ ] Focus trap order while a set is open: `Close zoom → Previous chart → Next chart → Zoom out → Zoom in → Fit the whole chart on screen`
- [ ] At fit the horizontal arrows step and the zoom is preserved (`0` then `ArrowRight` → chip `1 / 2` from `2 / 2`, wrapped); zoomed they still pan (no step)
- [ ] `prettier --write`, `tsc --noEmit`, `eslint` all 0

## Usage
- count: 2
- 2026-09-16: **stepping inside the viewer** — user: *"while the users are zoomed in on mobile and desktop … they don't have any option to see the next image. They have to manually click out, manually click the next page, then manually zoom in on the next page. That's so much work, so many steps. Let's just make it so that even while the users are zoomed in, they still have that little arrow button to switch images while in the zoom mode."* Added the optional `onPrev`/`onNext`/`position` props, the floating `‹ ›` row and the `1 / 2` chip, and the at-fit arrow-key step; the carousel gained `stepZoom` (moves `zoomed` **and** `index`, circular) and now passes a positional `label`. **Kept the transform across a step** (the set shares `SLIDE_RATIO`) rather than resetting to the opening scale — it is the difference between "compare the next chart" and "start over on the next chart", and it is one `apply` call to change if the user prefers a reset. Fixed a bug this feature exposed: the viewer's keydown effect re-ran on every render (callers pass fresh closures) and its `previousFocus`/`closeRef` focus work ran with it, so **every press of `Next` moved focus to Close and `Enter` then closed the viewer** — focus capture/restore is now its own mount-only effect, and the same probe confirmed focus stays on the pressed arrow. Pitfalls 13–16 and step 10 written from what the live run taught.
- 2026-09-15: created for the Artificial Analysis chart carousel. User: *"can we make it so that mobile users can click on it and zoom into the images, because right now it's very small for them?"* → chose **zoom_only** (keep the carousel as-is, tapping a chart opens it big) over replacing the carousel, and **everywhere** (mobile tap + desktop click). New `web/components/ui/image-zoom.tsx`; `intelligence-carousel.tsx` gained `zoomed` state, the per-slide `<button aria-label="Zoom into chart N of M">` gated on `pressRef`/`TAP_SLOP`, and `zoomed !== null` added to the autoplay pause condition. Fixes found while verifying: `resetToFit` → `fitWhole` (Pitfall 9), and a duplicated `measure` that had taken the dev server down (Pitfall 3).
