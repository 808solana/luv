import { ShieldedImage } from "@/components/ui/shielded-image";
import { MODEL_PANE_SLIDES, type ModelCoverSlide } from "@/lib/model-slides";
import { cn } from "@/lib/utils";

function ModelRow({ slide }: { slide: ModelCoverSlide }) {
  return (
    <article className="flex items-center gap-3 py-2.5">
      <ShieldedImage
        src={slide.src}
        alt={slide.alt}
        className="size-8 shrink-0 sm:size-9"
      />
      <div className="min-w-0 w-max max-w-full">
        <h3 className="text-[15px] font-semibold tracking-tight text-black">
          {slide.title}
        </h3>
        {slide.meta && slide.meta.length > 0 ? (
          <dl className="mt-0.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[12px] leading-5">
            {slide.meta.map((row) => (
              <div key={row.label} className="flex flex-wrap items-baseline gap-x-1.5">
                <dt className="text-black/45">
                  {row.label}
                  {row.suffix ? ":" : ""}
                </dt>
                <dd
                  className={cn(
                    "font-medium text-black",
                    row.label === "ID" ? "font-mono text-black/70" : "tabular-nums",
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
      </div>
    </article>
  );
}

/** Compact stacked catalog of hosted models. */
export function ModelPane() {
  return (
    <div
      className="mx-auto w-max max-w-full divide-y divide-black/10 xl:mx-0"
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
