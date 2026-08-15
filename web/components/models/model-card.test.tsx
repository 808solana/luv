import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModelCard } from "@/components/models/model-card";
import { DIRECTORY_MODELS } from "@/lib/models";

describe("ModelCard", () => {
  it("expands the live GLM contract inline", () => {
    render(<ModelCard model={DIRECTORY_MODELS[0]} />);

    expect(screen.queryByText("Not supported")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Model details" }));

    expect(screen.getAllByText("$0.33 / 1M total tokens")).toHaveLength(2);
    expect(screen.getByText("Supported")).toBeInTheDocument();
    expect(screen.getByText("Not supported")).toBeInTheDocument();
    expect(screen.getAllByText("luv13-glm-5.2")).toHaveLength(2);
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
          capabilities: ["text"],
          status: "Coming soon",
          available: false,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Coming soon" })).toBeDisabled();
  });
});
