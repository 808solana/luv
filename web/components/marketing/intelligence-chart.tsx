const INTELLIGENCE_INDEX_HREF = "https://artificialanalysis.ai/#intelligence";

/** Natural size of public/BRAND_ASSETS/intelligence-index.png (2.5x upscale). */
const CARD_WIDTH = 2560;
const CARD_HEIGHT = 938;

/**
 * Static Artificial Analysis Intelligence Index card. Borderless on a white
 * background so it blends straight into the page — no frame, no card, no
 * shadow — and sits right of the hosted model list (stacked below it under xl).
 * The image is the source of truth for the bars, labels and scores.
 */
export function IntelligenceChart() {
  return (
    <figure className="w-full min-w-0 xl:flex-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand raster, keep intrinsic 1024x375 box */}
      <img
        src="/BRAND_ASSETS/intelligence-index.png"
        alt="Artificial Analysis Intelligence Index, September 2026. Ten models ranked by index score: Claude Fable 5.1 and GPT-6 Astra lead at 53, followed by Claude Opus 5 (50), Muse Spark 1.3 (47), GLM-5.3 (45), Kimi K3 (44), Gemini 3.8 Flash (42) and DeepSeek V4.1 Flash (40); Qwen3.8 27B (34) and DeepSeek V4 Pro (31) close the list."
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        loading="lazy"
        decoding="async"
        className="h-auto w-full max-w-full select-none [-webkit-touch-callout:none] xl:max-w-[80rem]"
      />

      <figcaption className="hero-neuralwatt mt-5 text-left md:mt-6">
        <a
          href={INTELLIGENCE_INDEX_HREF}
          target="_blank"
          rel="noopener noreferrer"
        >
          facts by artificialanalysis.ai
        </a>
      </figcaption>
    </figure>
  );
}
