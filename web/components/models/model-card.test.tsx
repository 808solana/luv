import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModelCard } from "@/components/models/model-card";
import { DIRECTORY_MODELS } from "@/lib/models";

afterEach(() => {
  cleanup();
});

describe("ModelCard", () => {
  it("renders DeepSeek V4 Flash with screenshot-accurate rates", () => {
    const flash = DIRECTORY_MODELS.find((m) => m.id === "deepseek-v4-flash")!;
    render(<ModelCard model={flash} />);

    expect(screen.getByText("DeepSeek V4 Flash")).toBeInTheDocument();
    expect(screen.getByText("DeepSeek")).toBeInTheDocument();
    expect(screen.getByText("1048.576K")).toBeInTheDocument();
    expect(screen.getByText("$0.14")).toBeInTheDocument();
    expect(screen.getByText("/M tokens")).toBeInTheDocument();
    expect(screen.getByText("Reasoning")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(screen.getByText("JSON")).toBeInTheDocument();
    expect(screen.getByText("Flex")).toBeInTheDocument();
    expect(screen.getByText("$0.14/M tokens")).toBeInTheDocument();
    expect(screen.getByText("$0.03/M tokens")).toBeInTheDocument();
    expect(screen.getByText("$0.28/M tokens")).toBeInTheDocument();
    expect(
      screen.getByText(/\$1\.15 ↔ 1M Cursor tokens/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Try Now" }),
    ).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Details" })).toBeInTheDocument();
  });

  it("shows Preview + Request access for gated models", () => {
    const pro = DIRECTORY_MODELS.find((m) => m.id === "deepseek-v4-pro")!;
    render(<ModelCard model={pro} />);

    expect(screen.getByText("DeepSeek V4-Pro")).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("$1.00")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request access" }),
    ).toHaveAttribute("href", "/signup");
  });

  it("renders Gemma 4 31B with portal context and rates", () => {
    const gemma = DIRECTORY_MODELS.find((m) => m.id === "gemma-4-31b")!;
    render(<ModelCard model={gemma} />);

    expect(screen.getByText("Gemma 4 31B")).toBeInTheDocument();
    expect(screen.getByText("262.144K")).toBeInTheDocument();
    expect(screen.getByText("$0.14")).toBeInTheDocument();
    expect(screen.getByText("$0.01/M tokens")).toBeInTheDocument();
    expect(screen.getByText("$0.42/M tokens")).toBeInTheDocument();
    expect(screen.getByText("Vision")).toBeInTheDocument();
  });

  it("renders Qwen3 Embedding 8B as an embedding preview, not a chat model", () => {
    const embedding = DIRECTORY_MODELS.find(
      (m) => m.id === "qwen3-embedding-8b",
    )!;
    render(<ModelCard model={embedding} />);

    expect(screen.getByText("Qwen3 Embedding 8B")).toBeInTheDocument();
    expect(screen.getByText("Embedding")).toBeInTheDocument();
    expect(screen.getByText("8.192K")).toBeInTheDocument();
    expect(screen.getByText("$0.01")).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request access" }),
    ).toHaveAttribute("href", "/signup");
    expect(screen.queryByText("Reasoning")).not.toBeInTheDocument();
  });

  it("keeps portal slugs unique in the catalog", () => {
    const ids = DIRECTORY_MODELS.map((m) => m.id);
    const identifiers = DIRECTORY_MODELS.map((m) => m.identifier);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(identifiers).size).toBe(identifiers.length);
    expect(identifiers).toContain("glm-5.3");
    expect(identifiers).toContain("glm-5.3-flash");
    expect(identifiers).toContain("kimi-k3-fast");
    expect(identifiers).toContain("deepseek-v4.1-flash");
    expect(identifiers).toContain("gemma-4-31b");
    expect(identifiers.filter((id) => id === "glm-5.2")).toHaveLength(1);
  });

  it("keeps coming-soon models unusable", () => {
    render(
      <ModelCard
        model={{
          id: "future",
          name: "Future model",
          identifier: "future",
          provider: "LUV13",
          description: "Not available yet.",
          capabilities: ["tools"],
          status: "Coming soon",
          available: false,
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Coming soon" }),
    ).toBeDisabled();
  });
});
