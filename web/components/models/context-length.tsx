import { formatContextLength } from "@/lib/model-directory";

export function ContextLength({ contextTokens }: { contextTokens?: number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">
        Context
      </p>
      <p className="mt-1 text-sm font-semibold text-black/75">
        {formatContextLength(contextTokens)}
      </p>
    </div>
  );
}
