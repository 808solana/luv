"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CapabilityBadge } from "@/components/models/capability-badge";
import { ContextLength } from "@/components/models/context-length";
import { PricingDisplay } from "@/components/models/pricing-display";
import { CopyField } from "@/components/ui/copy-field";
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
  const [expanded, setExpanded] = useState(false);

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
              <p
                className="mt-0.5 truncate font-mono text-xs text-black/50"
                title={model.identifier}
              >
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
            by{" "}
            <span className="font-medium text-black/70">{model.provider}</span>
          </p>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-black/70">
            {model.description}
          </p>

          <div
            className="mt-4 flex flex-wrap gap-1.5"
            aria-label="Capabilities"
          >
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
      <button
        type="button"
        disabled={!model.available}
        aria-expanded={model.available ? expanded : undefined}
        onClick={() => setExpanded((value) => !value)}
        className="mt-5 flex min-h-11 w-full items-center justify-between rounded-lg bg-black/[0.035] px-4 text-sm font-bold text-black transition-[transform,background-color] duration-150 hover:bg-black/[0.07] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100"
      >
        <span>{model.available ? "Model details" : "Coming soon"}</span>
        {model.available && (
          <ChevronDown
            size={17}
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        )}
      </button>
      {model.available && expanded && (
        <div className="mt-4 rounded-xl bg-black/[0.025] p-4 ring-1 ring-black/[0.06] sm:p-5">
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-black/45">Price</dt>
              <dd className="mt-1 font-bold tabular-nums">
                $0.33 / 1M total tokens
              </dd>
            </div>
            <div>
              <dt className="text-black/45">Tools</dt>
              <dd className="mt-1 font-bold">Supported</dd>
            </div>
            <div>
              <dt className="text-black/45">Vision</dt>
              <dd className="mt-1 font-bold">Not supported</dd>
            </div>
          </dl>
          <div className="mt-5">
            <CopyField label="Model slug" value={model.identifier} />
          </div>
        </div>
      )}
    </article>
  );
}
