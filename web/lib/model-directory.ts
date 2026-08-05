export const CAPABILITIES = [
  "text",
  "vision",
  "reasoning",
  "tool-use",
  "coding",
  "audio",
  "embeddings",
  "flex",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type PriceUnit = "per_token" | "per_million_tokens";
export type ModelSort = "popular" | "newest" | "lowest-price" | "highest-context";

export type ModelPrice = {
  amount: number;
  unit: PriceUnit;
};

export type DirectoryModel = {
  id: string;
  name: string;
  identifier: string;
  provider: string;
  description: string;
  capabilities: Capability[];
  inputPrice?: ModelPrice;
  outputPrice?: ModelPrice;
  contextTokens?: number;
  status?: string;
  badges?: string[];
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

/**
 * Returns the all-in price for one million input plus one million output tokens.
 * A result is intentionally unavailable until both sides have a known unit/value.
 */
export function getTotalPricePerMillionTokens(model: DirectoryModel): number | null {
  const input = normalizeToPricePerMillion(model.inputPrice);
  const output = normalizeToPricePerMillion(model.outputPrice);

  return input === null || output === null ? null : input + output;
}

export function formatTotalPricePerMillion(model: DirectoryModel): string {
  const total = getTotalPricePerMillionTokens(model);
  if (total === null) return "Pricing unavailable";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(total) + " / 1M total tokens";
}

export function formatContextLength(contextTokens?: number): string {
  if (!contextTokens || !Number.isFinite(contextTokens) || contextTokens <= 0) {
    return "Context unavailable";
  }

  if (contextTokens >= 1_000_000) {
    return `${formatCompactNumber(contextTokens / 1_000_000)}M context`;
  }

  if (contextTokens >= 1_000) {
    return `${formatCompactNumber(contextTokens / 1_000)}K context`;
  }

  return `${contextTokens.toLocaleString("en-US")} context`;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
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

export function sortModels(models: DirectoryModel[], sort: ModelSort): DirectoryModel[] {
  return [...models].sort((a, b) => {
    if (sort === "lowest-price") {
      return compareNullable(getTotalPricePerMillionTokens(a), getTotalPricePerMillionTokens(b));
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

function compareNullable(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}
