import { formatTotalPricePerMillion, type DirectoryModel } from "@/lib/model-directory";

export function PricingDisplay({ model }: { model: DirectoryModel }) {
  const unavailable = formatTotalPricePerMillion(model) === "Pricing unavailable";

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">
        Total price
      </p>
      <p className={`mt-1 text-sm font-semibold ${unavailable ? "text-black/50" : "text-black"}`}>
        {formatTotalPricePerMillion(model)}
      </p>
    </div>
  );
}
