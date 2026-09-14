import type { LucideIcon } from "lucide-react";
import { DollarSignIcon, TrendingUpIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Card05Props = {
  /** Small label above the big number (e.g. "Price / 1M tokens"). */
  label: string;
  /** Primary metric — keep tabular-nums for money and token counts. */
  value: string;
  /** Optional trailing note under the value row (e.g. "vs. last month"). */
  footnote?: string;
  /** Badge text next to the footnote (e.g. "+20.1%" or "1M context"). */
  badge?: string;
  /** Badge tone. Default emerald for positive deltas. */
  badgeTone?: "positive" | "neutral" | "muted";
  /** Top-right icon. Defaults to dollar sign. */
  icon?: LucideIcon;
  className?: string;
};

/**
 * Compact metric card (shadcn card-05 pattern).
 * Used for model directory stats: price, context, capability chips.
 */
export function Card05({
  label,
  value,
  footnote,
  badge,
  badgeTone = "positive",
  icon: Icon = DollarSignIcon,
  className,
}: Card05Props) {
  const badgeClass =
    badgeTone === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : badgeTone === "muted"
        ? "text-black/55"
        : "text-black/70";

  return (
    <Card
      className={cn(
        "relative w-full border-black/10 bg-white shadow-none",
        className,
      )}
    >
      <div className="absolute top-6 right-6">
        <div className="flex size-9 items-center justify-center rounded-lg bg-black/[0.04]">
          <Icon className="size-4 text-black/45" aria-hidden="true" />
        </div>
      </div>
      <CardHeader className="pr-14">
        <CardDescription className="text-black/45">{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums tracking-tight text-black">
          {value}
        </CardTitle>
      </CardHeader>
      {(badge || footnote) && (
        <CardDescription className="flex flex-wrap items-center gap-2 px-6 pb-6 text-black/50">
          {badge ? (
            <Badge
              variant="secondary"
              className={cn(
                "gap-1 border-transparent bg-black/[0.04] font-semibold",
                badgeClass,
              )}
            >
              {badgeTone === "positive" ? (
                <TrendingUpIcon className="size-3" aria-hidden="true" />
              ) : null}
              {badge}
            </Badge>
          ) : null}
          {footnote ? <span>{footnote}</span> : null}
        </CardDescription>
      )}
    </Card>
  );
}

/** Demo / reference instance matching the upstream card-05 sample. */
export function Card05Demo() {
  return (
    <Card05
      label="Total revenue"
      value="$48,231.89"
      badge="+20.1%"
      footnote="vs. last month"
      className="max-w-xs"
    />
  );
}

export default Card05;
