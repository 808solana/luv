export const CAPABILITIES = [
  "tools",
  "vision",
  "files",
  "reasoning",
  "json",
  "flex",
  "embedding",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type PriceUnit = "per_token" | "per_million_tokens";
export type ModelSort =
  | "popular"
  | "newest"
  | "lowest-price"
  | "highest-context";

/** Cursor list price used as the public $/1M reference (1M tokens ↔ $1.15). */
export const CURSOR_USD_PER_MILLION_TOKENS = 1.15;

export type ModelPrice = {
  amount: number;
  unit: PriceUnit;
};

/** Inclusive $/1M token band shown when a model has no split rates. */
export type ModelPriceRange = {
  min: number;
  max: number;
  unit: "per_million_tokens";
};

/** Provider list rates — dollars per 1M tokens (matches directory screenshots). */
export type ModelTokenRates = {
  inputPerMillion: number;
  cachedInputPerMillion?: number;
  outputPerMillion: number;
};

export type ModelCta = "try_now" | "request_access";

export type DirectoryModel = {
  id: string;
  name: string;
  identifier: string;
  provider: string;
  description: string;
  capabilities: Capability[];
  /** Split token rates from the provider card (factual). */
  rates?: ModelTokenRates;
  /** Single all-in band. Prefer over legacy totalPrice when set. */
  price?: ModelPriceRange;
  /** @deprecated Prefer `price` range. Kept for older catalog rows. */
  totalPrice?: ModelPrice;
  contextTokens?: number;
  /** e.g. "max / high / none (default)" */
  effort?: string;
  status?: string;
  available?: boolean;
  /** Face badge e.g. "Preview" */
  badges?: string[];
  /** Primary CTA on the card face. */
  cta?: ModelCta;
  popularity?: number;
  releasedAt?: string;
};

export type ModelDirectoryFilters = {
  query: string;
  provider: string;
  capabilities: Capability[];
  sort: ModelSort;
};

/** Converts a stated token price to dollars per one million tokens. */
export function normalizeToPricePerMillion(price?: ModelPrice): number | null {
  if (!price || !Number.isFinite(price.amount) || price.amount < 0) return null;

  return price.unit === "per_token" ? price.amount * 1_000_000 : price.amount;
}

export function formatUsd(amount: number): string {
  // Provider cards always show two decimals for list rates ($1.00, $0.14).
  const fractionDigits =
    Number.isInteger(amount) || Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-9
      ? 2
      : Math.min(4, Math.max(2, (amount.toString().split(".")[1] ?? "").length));

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/** `$0.14/M tokens` style used on provider directory cards. */
export function formatPerMillionRate(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "—";
  return `${formatUsd(amount)}/M tokens`;
}

/**
 * Card price line for the hero metric:
 * prefers input rate from `rates`, else band / flat total.
 */
export function formatCardPrice(model: DirectoryModel): string {
  if (model.rates && Number.isFinite(model.rates.inputPerMillion)) {
    return formatPerMillionRate(model.rates.inputPerMillion);
  }

  if (model.price) {
    const { min, max } = model.price;
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return "Pricing unavailable";
    }
    if (min === max) {
      return `${formatUsd(min)} / 1M tokens`;
    }
    return `${formatUsd(min)} – ${formatUsd(max)} / 1M tokens`;
  }

  const flat = normalizeToPricePerMillion(model.totalPrice);
  if (flat === null) return "Pricing unavailable";
  return `${formatUsd(flat)} / 1M tokens`;
}

/** Sort key: input rate, else low end of the band, else flat total. */
export function getSortPrice(model: DirectoryModel): number | null {
  if (model.rates && Number.isFinite(model.rates.inputPerMillion)) {
    return model.rates.inputPerMillion;
  }
  if (model.price && Number.isFinite(model.price.min)) return model.price.min;
  return normalizeToPricePerMillion(model.totalPrice);
}

/** @deprecated Use formatCardPrice. */
export function formatTotalPricePerMillion(model: DirectoryModel): string {
  return formatCardPrice(model);
}

/** @deprecated Use getSortPrice. */
export function getTotalPricePerMillionTokens(
  model: DirectoryModel,
): number | null {
  return getSortPrice(model);
}

/**
 * How many Cursor-priced tokens $amount buys at $1.15 / 1M tokens.
 * 1M tokens ↔ $1.15 (and $1.15 ↔ 1M tokens).
 */
export function cursorTokensForUsd(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  return (usd / CURSOR_USD_PER_MILLION_TOKENS) * 1_000_000;
}

/** Compact label: "$1.15 → 1M Cursor tokens". */
export function formatCursorExchange(usd = CURSOR_USD_PER_MILLION_TOKENS): string {
  const tokens = cursorTokensForUsd(usd);
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    const mLabel = Number.isInteger(m) ? String(m) : m.toFixed(2);
    return `${formatUsd(usd)} ↔ ${mLabel}M Cursor tokens`;
  }
  if (tokens >= 1_000) {
    return `${formatUsd(usd)} ↔ ${Math.round(tokens / 1_000)}K Cursor tokens`;
  }
  return `${formatUsd(usd)} ↔ ${Math.round(tokens).toLocaleString("en-US")} Cursor tokens`;
}

/**
 * Public context labels matching provider cards
 * (e.g. 1_048_576 → 1048.576K, 262_144 → 262.144K, 8_192 → 8.192K).
 */
export function formatContextLength(contextTokens?: number): string {
  if (!contextTokens || !Number.isFinite(contextTokens) || contextTokens <= 0) {
    return "Context unavailable";
  }

  if (contextTokens >= 1_000) {
    const thousands = contextTokens / 1_000;
    if (Number.isInteger(thousands)) {
      return `${thousands}K`;
    }
    // Keep up to 3 decimal places like provider directory cards.
    const label = thousands
      .toFixed(3)
      .replace(/\.?0+$/, "");
    return `${label}K`;
  }

  return contextTokens.toLocaleString("en-US");
}

export function filterModels(
  models: DirectoryModel[],
  filters: Pick<ModelDirectoryFilters, "query" | "provider" | "capabilities">,
): DirectoryModel[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return models.filter((model) => {
    const searchableText = [
      model.name,
      model.identifier,
      model.provider,
      model.description,
      ...model.capabilities,
      ...(model.badges ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase();

    const matchesQuery = !query || searchableText.includes(query);
    const matchesProvider =
      filters.provider === "all" || model.provider === filters.provider;

    // Active capability filters combine with AND semantics: each selected
    // capability must be present on a model for it to remain in the result set.
    const matchesCapabilities = filters.capabilities.every((capability) =>
      model.capabilities.includes(capability),
    );

    return matchesQuery && matchesProvider && matchesCapabilities;
  });
}

export function sortModels(
  models: DirectoryModel[],
  sort: ModelSort,
): DirectoryModel[] {
  return [...models].sort((a, b) => {
    if (sort === "lowest-price") {
      return compareNullable(getSortPrice(a), getSortPrice(b));
    }

    if (sort === "highest-context") {
      return compareNullable(b.contextTokens, a.contextTokens);
    }

    if (sort === "newest") {
      return compareNullable(
        b.releasedAt ? Date.parse(b.releasedAt) : null,
        a.releasedAt ? Date.parse(a.releasedAt) : null,
      );
    }

    return compareNullable(b.popularity, a.popularity);
  });
}

function compareNullable(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}
