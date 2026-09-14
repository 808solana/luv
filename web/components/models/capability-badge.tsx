import { Badge } from "@/components/ui/badge";
import type { Capability } from "@/lib/model-directory";
import { cn } from "@/lib/utils";

const labels: Record<Capability, string> = {
  tools: "Tools",
  vision: "Vision",
  files: "Files",
  reasoning: "Reasoning",
  json: "JSON",
  flex: "Flex",
  embedding: "Embedding",
};

/** Soft color chips matching the provider directory cards. */
const tones: Record<Capability, string> = {
  reasoning:
    "border-transparent bg-amber-700/90 text-white hover:bg-amber-700/90",
  tools: "border-transparent bg-emerald-700/90 text-white hover:bg-emerald-700/90",
  vision: "border-transparent bg-blue-600/90 text-white hover:bg-blue-600/90",
  json: "border-transparent bg-violet-700/90 text-white hover:bg-violet-700/90",
  flex: "border-transparent bg-teal-600/90 text-white hover:bg-teal-600/90",
  files: "border-transparent bg-black/70 text-white hover:bg-black/70",
  embedding:
    "border-transparent bg-indigo-700/90 text-white hover:bg-indigo-700/90",
};

export function CapabilityBadge({ capability }: { capability: Capability }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-tight",
        tones[capability],
      )}
    >
      {labels[capability]}
    </Badge>
  );
}

export const capabilityLabel = (capability: Capability) => labels[capability];
