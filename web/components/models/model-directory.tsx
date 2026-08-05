"use client";

import { useMemo, useState } from "react";
import { EmptyModelState } from "@/components/models/empty-model-state";
import { ModelCard } from "@/components/models/model-card";
import { ModelFilters } from "@/components/models/model-filters";
import {
  filterModels,
  sortModels,
  type Capability,
  type DirectoryModel,
  type ModelDirectoryFilters,
} from "@/lib/model-directory";

const initialFilters: ModelDirectoryFilters = {
  query: "",
  provider: "all",
  capabilities: [],
  sort: "popular",
};

export function ModelDirectory({ models }: { models: DirectoryModel[] }) {
  const [filters, setFilters] = useState<ModelDirectoryFilters>(initialFilters);
  const providers = useMemo(
    () => [...new Set(models.map((model) => model.provider))].sort(),
    [models],
  );
  const results = useMemo(
    () => sortModels(filterModels(models, filters), filters.sort),
    [filters, models],
  );

  const toggleCapability = (capability: Capability) => {
    setFilters((current) => ({
      ...current,
      capabilities: current.capabilities.includes(capability)
        ? current.capabilities.filter((item) => item !== capability)
        : [...current.capabilities, capability],
    }));
  };

  return (
    <section aria-labelledby="model-directory-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/45">Models</p>
          <h1 id="model-directory-heading" className="mt-2 text-3xl font-bold tracking-tight text-black sm:text-4xl">
            Model directory
          </h1>
        </div>
        <p className="text-sm text-black/55" aria-live="polite">
          {results.length} {results.length === 1 ? "model" : "models"}
        </p>
      </div>

      <div className="mt-7">
        <ModelFilters
          query={filters.query}
          provider={filters.provider}
          providers={providers}
          capabilities={filters.capabilities}
          sort={filters.sort}
          onQueryChange={(query) => setFilters((current) => ({ ...current, query }))}
          onProviderChange={(provider) => setFilters((current) => ({ ...current, provider }))}
          onCapabilityToggle={toggleCapability}
          onSortChange={(sort) => setFilters((current) => ({ ...current, sort }))}
        />
      </div>

      <div className="mt-5">
        {results.length > 0 ? (
          <div className="flex flex-col gap-3">
            {results.map((model) => <ModelCard key={model.id} model={model} />)}
          </div>
        ) : (
          <EmptyModelState onClear={() => setFilters(initialFilters)} />
        )}
      </div>
    </section>
  );
}
