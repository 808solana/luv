import {
  ArrowRight,
  Image as ImageIcon,
  Type,
  Video,
  type LucideIcon,
} from "lucide-react";

import { ShieldedImage } from "@/components/ui/shielded-image";
import { MagneticButton } from "@/components/ui/magnetic-button";
import {
  MODEL_PANE_SLIDES,
  type ModalityKind,
  type ModelCoverSlide,
  type ModelModalities,
} from "@/lib/model-slides";
import { cn } from "@/lib/utils";

/**
 * The Modalities module — what the model takes in and gives back.
 *
 * It copies the module on each model's full page: one rounded square per
 * modality, tinted with that modality's colour and carrying its glyph, an
 * arrow, then the output square. The reference tints each square with its own
 * glyph colour at 12% (sampled: `#3b86f6`, `#4a895c`, `#ec5528` over its card),
 * which is reproduced here against the white row.
 *
 * Adding a modality: add the kind to `ModalityKind` in `lib/model-slides.ts`
 * and one entry here. Do not invent a hue — take it from the reference.
 */
const MODALITY_TILES: Record<
  ModalityKind,
  { label: string; Icon: LucideIcon; className: string }
> = {
  text: {
    label: "text",
    Icon: Type,
    className: "bg-[#3b86f6]/12 text-[#3b86f6]",
  },
  image: {
    label: "image",
    Icon: ImageIcon,
    className: "bg-[#4a895c]/12 text-[#4a895c]",
  },
  video: {
    label: "video",
    Icon: Video,
    className: "bg-[#ec5528]/12 text-[#ec5528]",
  },
};

function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** Spoken form of the module, e.g. “text, image and video in; text out”. */
function describeModalities(modalities: ModelModalities): string {
  const input = listWords(
    modalities.input.map((kind) => MODALITY_TILES[kind].label),
  );
  const output = listWords(
    modalities.output.map((kind) => MODALITY_TILES[kind].label),
  );
  return `${input} in; ${output} out`;
}

function ModalityTile({ kind }: { kind: ModalityKind }) {
  const { Icon, className } = MODALITY_TILES[kind];

  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-[3px] sm:size-6 sm:rounded-[4px]",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={2.25}
        className="size-3 sm:size-[0.9375rem]"
      />
    </span>
  );
}

/** Modalities line: label, input squares, arrow, output squares. */
function ModalitiesRow({ modalities }: { modalities: ModelModalities }) {
  return (
    <dl className="flex flex-wrap items-center gap-x-[3.864px] sm:gap-x-[4.83px]">
      <dt className="text-[7.728px] leading-[12.88px] text-black/45 sm:text-[9.66px] sm:leading-[16.1px]">
        Modalities:
      </dt>
      <dd className="flex items-center">
        {/* The squares are decorative; this line is the accessible value. */}
        <span className="sr-only">{describeModalities(modalities)}</span>
        <span
          aria-hidden="true"
          className="flex items-center gap-x-[2.5px] sm:gap-x-[3px]"
        >
          {modalities.input.map((kind) => (
            <ModalityTile key={kind} kind={kind} />
          ))}
          <ArrowRight
            strokeWidth={2.25}
            className="size-[10px] shrink-0 text-black/40 sm:size-[12px]"
          />
          {modalities.output.map((kind) => (
            <ModalityTile key={kind} kind={kind} />
          ))}
        </span>
      </dd>
    </dl>
  );
}

/**
 * “Open” pill — the row's link to the model's full page. Small on purpose: it
 * is a companion to the row, not a CTA, so it takes the site pill recipe at
 * row scale (regrow hover, 0.96 press) over the **light-ground liquid glass**
 * surface (`liquid-glass-pill`, globals.css). The `::after` box is what lifts
 * the 20px control to a 44px tap target.
 *
 * Wrapped in `MagneticButton` for the pointer follow; it lives on the Modalities
 * line beside the tiles, and the row carries `data-magnetic-bounds` so the
 * follow is clamped inside its own row.
 */
function OpenPill({ name, href }: { name: string; href: string }) {
  return (
    <MagneticButton className="shrink-0">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${name} on OpenRouter`}
        className="liquid-glass-pill relative inline-flex h-5 shrink-0 items-center justify-center rounded-full px-[7px] text-[9px] leading-none font-semibold tracking-tight text-black transition-[transform,box-shadow,background-color,color] duration-200 ease-out after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-[''] hover:scale-[1.02] focus-visible:outline-none active:scale-[0.96] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 sm:h-6 sm:px-2 sm:text-[10.5px]"
      >
        Open
      </a>
    </MagneticButton>
  );
}

/**
 * The “Neuralwatt Special” badge — a **label, not a link**.
 *
 * It wears the pill's glass surface so it sits in the row as the same kind of
 * object as its neighbours, but it is deliberately **not** interactive, and it
 * must not borrow any cue that says otherwise:
 *
 * - **`span`, not `a`.** No `href`, nothing to focus, nothing to open. Kimi K3
 *   Fast has no page to point at (see `DETAILS` in `lib/model-slides.ts`), and
 *   an `<a>` with no target is a broken promise.
 * - **No `MagneticButton`.** The pointer follow is a "click me" cue; a badge
 *   that trails the cursor is a false affordance. This is a real difference from
 *   the Open pill beside it, on purpose.
 * - **No `::after` hit box.** The 44px tap floor exists for *targets*, so a
 *   label needs no invisible 48px hit area — that would only swallow hover and
 *   taps from whatever really is there.
 * - **No hover/press response** (`hover:scale-*`, `active:scale-*`, ring). The
 *   glass class's own `:hover`/`:focus-visible` rings are suppressed with
 *   `pointer-events-none`, which is the honest expression of "this is not a
 *   pointer target": the badge never becomes a hover target and its own
 *   text is allowed to sit inert under the cursor.
 *
 * The text stays real, readable text — no `aria-hidden`, no `sr-only` duplicate.
 * A screen reader reads the label in place, between the modalities sentence and
 * the row's end.
 */
function SpecialPill({ label }: { label: string }) {
  return (
    <span className="liquid-glass-pill pointer-events-none inline-flex h-5 shrink-0 items-center justify-center rounded-full px-[7px] text-[9px] leading-none font-semibold tracking-tight text-black sm:h-6 sm:px-2 sm:text-[10.5px]">
      {label}
    </span>
  );
}

function ModelRow({ slide }: { slide: ModelCoverSlide }) {
  return (
    <article
      data-magnetic-bounds
      className="flex items-center gap-[7.728px] py-[9.016px] sm:gap-[9.66px] sm:py-[11.27px]"
    >
      <ShieldedImage
        src={slide.src}
        alt={slide.alt}
        className="size-[3.01875rem] shrink-0 sm:size-[3.7734375rem]"
      />
      <div className="min-w-0 w-max max-w-full">
        <h3 className="text-[9.66px] font-semibold tracking-tight text-black sm:text-[12.075px]">
          {slide.title}
        </h3>
        {slide.meta && slide.meta.length > 0 ? (
          <dl className="mt-[1.288px] flex flex-wrap items-baseline gap-x-[10.304px] gap-y-[1.288px] text-[7.728px] leading-[12.88px] sm:mt-[1.61px] sm:gap-x-[12.88px] sm:gap-y-[1.61px] sm:text-[9.66px] sm:leading-[16.1px]">
            {slide.meta.map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap items-baseline gap-x-[3.864px] sm:gap-x-[4.83px]"
              >
                <dt className="text-black/45">
                  {row.label}
                  {row.suffix ? ":" : ""}
                </dt>
                <dd
                  className={cn(
                    "font-medium text-black",
                    row.label === "ID"
                      ? "font-mono text-black/70"
                      : "tabular-nums",
                  )}
                >
                  {row.value}
                  {row.suffix ? (
                    <span className="font-normal normal-nums text-black">
                      {"\u00a0\u00a0"}
                      {row.suffix}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {slide.modalities || slide.openHref || slide.badge ? (
          /* The `gap-x` here is the tile↔pill gutter — the wrapper's only two
             children are the modalities list and the pill, so this value tunes
             exactly one seam and nothing else. At the tiles' own 4.83px it read
             as one crowded cluster (the user: "the pill and the T is too close"),
             so it is deliberately ~2x the inter-tile gap. Plain scale values
             (8/10px) on purpose: this is an optical gutter, not a measurement
             taken off a reference. */
          <div className="mt-[6.088px] flex flex-wrap items-center gap-x-2 sm:mt-[7.61px] sm:gap-x-2.5">
            {slide.modalities ? (
              <ModalitiesRow modalities={slide.modalities} />
            ) : null}
            {slide.badge ? <SpecialPill label={slide.badge} /> : null}
            {slide.openHref ? (
              <OpenPill name={slide.title} href={slide.openHref} />
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Compact stacked catalog of hosted models. */
export function ModelPane() {
  return (
    <div
      className="mx-auto w-max max-w-full divide-y divide-black/10"
      role="list"
      aria-label="Hosted models"
    >
      {MODEL_PANE_SLIDES.map((slide) => (
        <div key={slide.subtitle} role="listitem">
          <ModelRow slide={slide} />
        </div>
      ))}
    </div>
  );
}
