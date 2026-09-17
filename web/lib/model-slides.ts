import {
  formatUsd,
  getSortPrice,
  type DirectoryModel,
} from "@/lib/model-directory";
import { DIRECTORY_MODELS } from "@/lib/models";

export type ModelCoverMeta = {
  label: string;
  value: string;
  /** Extra phrase after the value, e.g. “Per Million Tokens”. */
  suffix?: string;
  /**
   * Render `value` as the pane's click-to-copy control instead of plain text.
   * Set on the `ID` caption only — its value is the customer-facing LUV13 ID,
   * which is the one string on a row a visitor actually has to copy.
   */
  copy?: boolean;
};

/**
 * Modalities the model accepts / returns. Only the kinds the list renders
 * today; add another kind here and a tile in `model-pane.tsx` when a model
 * needs it.
 */
export type ModalityKind = "text" | "image" | "video";

export type ModelModalities = {
  input: ModalityKind[];
  output: ModalityKind[];
};

export type ModelCoverSlide = {
  src: string;
  alt: string;
  title: string;
  subtitle: string;
  meta: ModelCoverMeta[];
  /** Summary of what the model does, for first-time visitors. */
  modalities?: ModelModalities;
  /** “Open” pill target: the model's full OpenRouter page. */
  openHref?: string;
  /** Non-interactive badge pill, e.g. “Neuralwatt Special”. Label only. */
  badge?: string;
  fit?: "cover" | "contain";
  cardClassName?: string;
};

function formatPaneAmount(model: DirectoryModel): string {
  const amount = getSortPrice(model);
  if (amount == null) return "—";
  return formatUsd(amount);
}

type CoverArt = {
  src: string;
  alt: string;
  fit?: "cover" | "contain";
  cardClassName?: string;
};

const DEEPSEEK: CoverArt = {
  src: "/BRAND_ASSETS/models/deepseek.jpg",
  alt: "DeepSeek whale mark",
  fit: "contain",
  cardClassName: "bg-white",
};

const KIMI: CoverArt = {
  src: "/BRAND_ASSETS/models/kimi.jpg",
  alt: "Kimi mark",
  fit: "contain",
  cardClassName: "bg-white",
};

const QWEN: CoverArt = {
  src: "/BRAND_ASSETS/models/qwen.jpg",
  alt: "Qwen mark",
  fit: "contain",
  cardClassName: "bg-white",
};

const GLM: CoverArt = {
  src: "/BRAND_ASSETS/models/glm.jpg",
  alt: "GLM z.ai mark",
  fit: "contain",
  cardClassName: "bg-white",
};

const COVERS: Record<string, CoverArt> = {
  "deepseek-v4-1-flash": DEEPSEEK,
  "deepseek-v4-pro": DEEPSEEK,
  "kimi-k3": KIMI,
  "kimi-k3-fast": KIMI,
  "qwen-3-8-27b": QWEN,
  "glm-5-3": GLM,
  "glm-5-3-flash": GLM,
};

/**
 * Tourist-facing facts, one entry per model, read off that model's OpenRouter
 * page. `modalities` is the pair the page itself states (“accepts text, images
 * and video as input and returns text”) — or, for a text-only model, the same
 * fact from OpenRouter's own `architecture.input_modalities` /
 * `output_modalities` API fields, because those pages carry **no** descriptive
 * sentence (their silence is the signal: only models with something beyond
 * plain text get one).
 *
 * `openHref` is the full page the row's Open pill opens, and it is **optional on
 * purpose**: a row can carry modalities without a pill. Kimi K3 Fast is that
 * case — it is a faster serving tier of Kimi K3 and has no page of its own on
 * OpenRouter (the only Kimi K3 entries are `moonshotai/kimi-k3` and its
 * `:batch` variant), so pointing its pill at the K3 page would claim a page that
 * is not about this row. Its modalities are shared with K3.
 *
 * A model with no entry here renders no Modalities line and no Open pill, so
 * rows can be filled in one at a time.
 *
 * `badge` is the third possibility: a **label, not a link** — a plain pill with
 * no `href`, no tap target and no hover/press response (see `SpecialPill` in
 * `model-pane.tsx`). Kimi K3 Fast is its only user: it has no page of its own,
 * so instead of a pill that goes nowhere it carries the “Neuralwatt Special”
 * marker. Do not wire it to an `href` — a pill that says where the model comes
 * from and a pill that takes you somewhere are different objects, and a
 * non-interactive pill must not borrow the click affordances (pointer follow,
 * ring, `::after` hit box) of an interactive one.
 *
 * Verified against `GET https://openrouter.ai/api/v1/models` (and the pages
 * themselves) on 2026-09-16. Note the OpenRouter slug is **not** derivable from
 * the caption `ID`: our `qwen-3.8-27b` is OpenRouter's `qwen/qwen3.8-27b`.
 */
type ModelDetail = {
  openHref?: string;
  badge?: string;
  modalities: ModelModalities;
};

const DETAILS: Record<string, ModelDetail> = {
  "kimi-k3": {
    openHref: "https://openrouter.ai/moonshotai/kimi-k3",
    modalities: { input: ["text", "image", "video"], output: ["text"] },
  },
  "kimi-k3-fast": {
    badge: "Neuralwatt Special",
    modalities: { input: ["text", "image", "video"], output: ["text"] },
  },
  "glm-5-3": {
    openHref: "https://openrouter.ai/z-ai/glm-5.3",
    modalities: { input: ["text"], output: ["text"] },
  },
  "glm-5-3-flash": {
    openHref: "https://openrouter.ai/z-ai/glm-5.3-flash",
    modalities: { input: ["text", "image", "video"], output: ["text"] },
  },
  "deepseek-v4-1-flash": {
    openHref: "https://openrouter.ai/deepseek/deepseek-v4.1-flash",
    modalities: { input: ["text", "image"], output: ["text"] },
  },
  "deepseek-v4-pro": {
    openHref: "https://openrouter.ai/deepseek/deepseek-v4-pro",
    modalities: { input: ["text"], output: ["text"] },
  },
  "qwen-3-8-27b": {
    openHref: "https://openrouter.ai/qwen/qwen3.8-27b",
    modalities: { input: ["text", "image", "video"], output: ["text"] },
  },
};

/**
 * Home model list — title is the model name; caption rows are
 * Context / Price / ID. Stacked compact rows.
 *
 * The `ID` caption shows the **customer-facing LUV13 ID** (`luv13/…`, from
 * `DirectoryModel.modelId`) as a click-to-copy control since 2026-09-16, not
 * the upstream `identifier` it used to print. See `ModelIdCopy`.
 *
 * Hide GLM-5.2 (older sibling of 5.3), DeepSeek V4 Flash (superseded by
 * V4.1 Flash on the pane), the embedding model (not a chat row), and
 * Gemma until a family mark exists (no whale fallback).
 */
const HIDDEN_FROM_PANE = new Set([
  "glm-5-2",
  "deepseek-v4-flash",
  "qwen3-embedding-8b",
  "gemma-4-31b",
]);

/** Stacked list order: Kimi family, GLM, DeepSeek, Qwen. */
const PANE_ORDER = [
  "kimi-k3",
  "kimi-k3-fast",
  "glm-5-3",
  "glm-5-3-flash",
  "deepseek-v4-1-flash",
  "deepseek-v4-pro",
  "qwen-3-8-27b",
];

export const MODEL_PANE_SLIDES: ModelCoverSlide[] = DIRECTORY_MODELS.filter(
  (model) => !HIDDEN_FROM_PANE.has(model.id),
)
  .sort((a, b) => {
    const ai = PANE_ORDER.indexOf(a.id);
    const bi = PANE_ORDER.indexOf(b.id);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  })
  .map((model) => {
    const cover = COVERS[model.id];
    const detail = DETAILS[model.id];

    // Caption rows. The `ID` caption carries the **customer-facing LUV13 ID**
    // and is click-to-copy in the pane; a model the user has not supplied an ID
    // for renders no caption at all, because the unbranded portal slug is not a
    // stand-in for one (see `DirectoryModel.modelId`).
    const meta: ModelCoverMeta[] = [
      { label: "Context", value: "1 million" },
      {
        label: "Price",
        value: formatPaneAmount(model),
        suffix: "Per Million Tokens",
      },
    ];
    if (model.modelId) {
      meta.push({ label: "ID", value: model.modelId, copy: true });
    }

    return {
      src: cover?.src ?? DEEPSEEK.src,
      alt: cover?.alt ?? `${model.name} cover`,
      title: model.name,
      subtitle: model.modelId ?? model.identifier,
      fit: cover?.fit,
      cardClassName: cover?.cardClassName,
      modalities: detail?.modalities,
      openHref: detail?.openHref,
      badge: detail?.badge,
      meta,
    };
  });
