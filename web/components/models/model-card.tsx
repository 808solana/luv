import { CapabilityBadge } from "@/components/models/capability-badge";
import { ContextLength } from "@/components/models/context-length";
import { PricingDisplay } from "@/components/models/pricing-display";
import type { DirectoryModel } from "@/lib/model-directory";

function ModelMark({ model }: { model: DirectoryModel }) {
  const initials = model.name
    .split(/\s|-/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-black/[0.035] text-sm font-bold tracking-tight text-black/75"
    >
      {initials}
    </div>
  );
}

export function ModelCard({ model }: { model: DirectoryModel }) {
  return (
    <article className="rounded-xl border border-black/10 bg-white px-4 py-5 sm:px-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <ModelMark model={model} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-black sm:text-lg">
                {model.name}
              </h2>
              <p className="mt-0.5 truncate font-mono text-xs text-black/50" title={model.identifier}>
                {model.identifier}
              </p>
            </div>
            {model.status && (
              <span className="rounded-full border border-black/10 bg-black/[0.035] px-2.5 py-1 text-xs font-semibold text-black/65">
                {model.status}
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-black/55">
            by <span className="font-medium text-black/70">{model.provider}</span>
          </p>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-black/70">
            {model.description}
          </p>

          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Capabilities">
            {model.capabilities.map((capability) => (
              <CapabilityBadge key={capability} capability={capability} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-black/8 pt-4 sm:grid-cols-2 sm:gap-6">
        <PricingDisplay model={model} />
        <ContextLength contextTokens={model.contextTokens} />
      </div>
    </article>
  );
}
