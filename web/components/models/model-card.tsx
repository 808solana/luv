"use client";

import Link from "next/link";
import { Coins, Layers, type LucideIcon } from "lucide-react";
import { CapabilityBadge } from "@/components/models/capability-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CURSOR_USD_PER_MILLION_TOKENS,
  formatContextLength,
  formatCursorExchange,
  formatPerMillionRate,
  formatUsd,
  type DirectoryModel,
} from "@/lib/model-directory";
import { cn } from "@/lib/utils";

/**
 * Mini metric tile in the card-05 spirit: muted label, big tabular value,
 * corner icon well — used for Context / Input price on the model face.
 */
function MetricTile({
  label,
  value,
  subvalue,
  icon: Icon,
}: {
  label: string;
  value: string;
  subvalue?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="relative min-w-0 flex-1 rounded-xl border border-black/[0.08] bg-black/[0.03] p-3 sm:p-3.5">
      <div className="absolute top-3 right-3">
        <div className="flex size-7 items-center justify-center rounded-md bg-black/[0.04]">
          <Icon className="size-3.5 text-black/40" aria-hidden="true" />
        </div>
      </div>
      <p className="pr-8 text-[11px] font-medium leading-tight text-black/45">
        {label}
      </p>
      <p className="mt-1.5 text-base font-semibold tabular-nums tracking-tight text-black sm:text-lg">
        {value}
      </p>
      {subvalue ? (
        <p className="mt-0.5 text-xs font-medium tabular-nums text-black/50">
          {subvalue}
        </p>
      ) : null}
    </div>
  );
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-black/45">{label}</dt>
      <dd className="font-semibold tabular-nums text-black">{value}</dd>
    </div>
  );
}

export function ModelCard({ model }: { model: DirectoryModel }) {
  const context = formatContextLength(model.contextTokens);
  const inputAmount = model.rates?.inputPerMillion;
  const inputRate =
    inputAmount != null ? formatPerMillionRate(inputAmount) : null;
  const cachedRate =
    model.rates?.cachedInputPerMillion != null
      ? formatPerMillionRate(model.rates.cachedInputPerMillion)
      : null;
  const outputRate =
    model.rates != null
      ? formatPerMillionRate(model.rates.outputPerMillion)
      : null;

  const isPreview = model.badges?.includes("Preview") ?? false;
  const requestAccess = model.cta === "request_access";
  const ctaLabel = !model.available
    ? "Coming soon"
    : requestAccess
      ? "Request access"
      : "Try Now";
  const ctaHref = model.available ? "/signup" : undefined;

  return (
    <Card
      id={model.id}
      className="relative w-full scroll-mt-24 overflow-hidden border-black/10 bg-white shadow-none"
    >
      {isPreview ? (
        <div className="absolute top-5 right-5 z-10">
          <Badge className="border-transparent bg-amber-700 text-[11px] font-semibold text-white hover:bg-amber-700">
            Preview
          </Badge>
        </div>
      ) : null}

      <CardHeader className={cn(isPreview && "pr-24")}>
        <CardTitle className="text-xl font-semibold tracking-tight text-black sm:text-2xl">
          {model.name}
        </CardTitle>
        <CardDescription className="text-black/50">
          {model.provider}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* card-05 style metric pair — facts from provider cards */}
        <div className="flex gap-2.5 sm:gap-3">
          <MetricTile label="Context" value={context} icon={Layers} />
          <MetricTile
            label="Input Price"
            value={inputAmount != null ? formatUsd(inputAmount) : "—"}
            subvalue={inputAmount != null ? "/M tokens" : undefined}
            icon={Coins}
          />
        </div>

        {/* Cursor exchange: $1.15 ↔ 1M tokens */}
        <p className="text-xs leading-5 text-black/40">
          Cursor rate ·{" "}
          <span className="font-medium tabular-nums text-black/55">
            {formatCursorExchange(CURSOR_USD_PER_MILLION_TOKENS)}
          </span>
        </p>

        {model.capabilities.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" aria-label="Capabilities">
            {model.capabilities.map((capability) => (
              <CapabilityBadge key={capability} capability={capability} />
            ))}
          </div>
        ) : null}

        {model.effort ? (
          <p className="text-sm text-black/45">
            Effort: <span className="text-black/65">{model.effort}</span>
          </p>
        ) : null}

        {model.rates ? (
          <dl className="space-y-2 border-t border-black/[0.06] pt-4">
            <RateRow label="Input:" value={inputRate ?? "—"} />
            {cachedRate != null ? (
              <RateRow label="Cached input:" value={cachedRate} />
            ) : null}
            <RateRow label="Output:" value={outputRate ?? "—"} />
          </dl>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        {ctaHref ? (
          <Link
            href={ctaHref}
            className={cn(
              "inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#e07a5f] px-5 text-sm font-bold text-white transition-[transform,background-color] duration-150",
              "hover:bg-[#d4694f] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30",
            )}
          >
            {ctaLabel}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex min-h-11 flex-1 cursor-not-allowed items-center justify-center rounded-full bg-[#e07a5f]/45 px-5 text-sm font-bold text-white"
          >
            {ctaLabel}
          </button>
        )}
        <Link
          href={`/models#${model.id}`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-black/15 bg-transparent px-5 text-sm font-semibold text-black/70 transition-colors hover:border-black/30 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 sm:min-w-[6.5rem]"
        >
          Details
        </Link>
      </CardFooter>
    </Card>
  );
}
