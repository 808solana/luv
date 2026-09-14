import { formatUsd, getSortPrice, type DirectoryModel } from "@/lib/model-directory";
import { DIRECTORY_MODELS } from "@/lib/models";

export type ModelCoverMeta = {
  label: string;
  value: string;
  /** Extra phrase after the value, e.g. “Per Million Tokens”. */
  suffix?: string;
};

export type ModelCoverSlide = {
  src: string;
  alt: string;
  title: string;
  subtitle: string;
  meta: ModelCoverMeta[];
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
 * Home model list — title is the model name; caption rows are
 * Context / Price / ID. Stacked compact rows.
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
    return {
      src: cover?.src ?? DEEPSEEK.src,
      alt: cover?.alt ?? `${model.name} cover`,
      title: model.name,
      subtitle: model.identifier,
      fit: cover?.fit,
      cardClassName: cover?.cardClassName,
      meta: [
        { label: "Context", value: "1 million" },
        {
          label: "Price",
          value: formatPaneAmount(model),
          suffix: "Per Million Tokens",
        },
        { label: "ID", value: model.identifier },
      ],
    };
  });
