import type { DirectoryModel } from "@/lib/model-directory";

// This is the current documented launch catalog. Add production model records
// here (or replace this module with the production catalog source) as models ship.
export const DIRECTORY_MODELS: DirectoryModel[] = [
  {
    id: "glm-5-2",
    name: "GLM-5.2",
    identifier: "luv13-glm-5.2",
    provider: "LUV13",
    description:
      "Our live GLM-5.2 route for coding agents, tool calls, streaming, and chat completions.",
    capabilities: ["text", "reasoning", "tool-use", "coding"],
    totalPrice: { amount: 0.33, unit: "per_million_tokens" },
    status: "Available",
    available: true,
    popularity: 1,
  },
];
