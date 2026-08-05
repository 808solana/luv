import { capabilityLabel } from "@/components/models/capability-badge";
import type { Capability, ModelSort } from "@/lib/model-directory";

const quickFilters: Capability[] = ["reasoning", "vision", "tool-use", "flex"];

type ModelFiltersProps = {
  query: string;
  provider: string;
  providers: string[];
  capabilities: Capability[];
  sort: ModelSort;
  onQueryChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onCapabilityToggle: (capability: Capability) => void;
  onSortChange: (sort: ModelSort) => void;
};

export function ModelFilters({
  query,
  provider,
  providers,
  capabilities,
  sort,
  onQueryChange,
  onProviderChange,
  onCapabilityToggle,
  onSortChange,
}: ModelFiltersProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-black/10 pb-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative block min-w-0 flex-1 lg:max-w-md">
          <span className="sr-only">Search models</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search models..."
            className="min-h-11 w-full rounded-lg border border-black/15 bg-white px-3.5 text-sm text-black outline-none placeholder:text-black/40 focus-visible:ring-2 focus-visible:ring-[#675c56] focus-visible:ring-offset-2"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <label className="sr-only" htmlFor="provider-filter">Provider</label>
          <select
            id="provider-filter"
            value={provider}
            onChange={(event) => onProviderChange(event.target.value)}
            className="min-h-11 rounded-lg border border-black/15 bg-white px-3.5 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] focus-visible:ring-offset-2"
          >
            <option value="all">All providers</option>
            {providers.map((providerName) => (
              <option key={providerName} value={providerName}>{providerName}</option>
            ))}
          </select>

          {quickFilters.map((capability) => {
            const active = capabilities.includes(capability);
            return (
              <button
                key={capability}
                type="button"
                aria-pressed={active}
                onClick={() => onCapabilityToggle(capability)}
                className={`min-h-11 rounded-lg border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] focus-visible:ring-offset-2 ${
                  active
                    ? "border-[#675c56] bg-[#675c56] text-white"
                    : "border-black/15 bg-white text-black/70 hover:bg-black/[0.035]"
                }`}
              >
                {capabilityLabel(capability)}
              </button>
            );
          })}
        </div>

        <label className="lg:ml-auto" htmlFor="sort-models">
          <span className="sr-only">Sort models</span>
          <select
            id="sort-models"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ModelSort)}
            className="min-h-11 w-full rounded-lg border border-black/15 bg-white px-3.5 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] focus-visible:ring-offset-2 sm:w-auto"
          >
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
            <option value="lowest-price">Lowest price</option>
            <option value="highest-context">Highest context</option>
          </select>
        </label>
      </div>
    </div>
  );
}
