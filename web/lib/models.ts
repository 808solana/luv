import type { DirectoryModel } from "@/lib/model-directory";

// This is the current documented launch catalog. Add production model records
// here (or replace this module with the production catalog source) as models ship.
export const DIRECTORY_MODELS: DirectoryModel[] = [
  {
    id: "glm-5-2",
    name: "GLM-5.2",
    identifier: "glm-5.2",
    provider: "LUV13",
    description:
      "The launch model for LUV13: one hosted language model with an OpenAI-compatible chat-completions endpoint, streaming, and batch responses.",
    capabilities: ["text"],
    inputPrice: { amount: 0.13, unit: "per_million_tokens" },
    outputPrice: { amount: 0.23, unit: "per_million_tokens" },
    status: "Coming soon",
  },
];
