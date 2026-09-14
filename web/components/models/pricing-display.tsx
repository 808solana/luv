import {
  formatCardPrice,
  type DirectoryModel,
} from "@/lib/model-directory";

export function PricingDisplay({ model }: { model: DirectoryModel }) {
  const label = formatCardPrice(model);
  const unavailable = label === "Pricing unavailable";

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">
        Price
      </p>
      <p
        className={`mt-1 text-sm font-semibold tabular-nums ${unavailable ? "text-black/50" : "text-black"}`}
      >
        {label}
      </p>
    </div>
  );
}
