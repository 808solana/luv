import type { Capability } from "@/lib/model-directory";

const labels: Record<Capability, string> = {
  text: "Text",
  vision: "Vision",
  reasoning: "Reasoning",
  "tool-use": "Tool use",
  coding: "Coding",
  audio: "Audio",
  embeddings: "Embeddings",
  flex: "Flex",
};

export function CapabilityBadge({ capability }: { capability: Capability }) {
  return (
    <span className="rounded-md border border-black/10 bg-black/[0.025] px-2 py-1 text-xs font-medium text-black/65">
      {labels[capability]}
    </span>
  );
}

export const capabilityLabel = (capability: Capability) => labels[capability];
