import { describe, expect, it } from "vitest";
import { MODEL_PANE_SLIDES } from "@/lib/model-slides";
import { DIRECTORY_MODELS } from "@/lib/models";

/**
 * The seven customer-facing LUV13 IDs the user supplied 2026-09-16. These are
 * hand-entered, not derivable from the portal slug (our `deepseek-v4-1-flash`
 * ids use `.` where the catalog's anchor `id` uses `-`), so pin them literally.
 */
const EXPECTED_CUSTOMER_IDS: Readonly<Record<string, string>> = {
  "deepseek-v4-pro": "luv13/deepseek-v4-pro",
  "deepseek-v4-1-flash": "luv13/deepseek-v4.1-flash",
  "glm-5-3-flash": "luv13/glm-5.3-flash",
  "glm-5-3": "luv13/glm-5.3",
  "kimi-k3": "luv13/kimi-k3",
  "kimi-k3-fast": "luv13/kimi-k3-fast",
  "qwen-3-8-27b": "luv13/qwen-3.8-27b",
};

describe("customer model IDs", () => {
  it("carries each LUV13 ID on its own catalog row", () => {
    expect(Object.keys(EXPECTED_CUSTOMER_IDS)).toHaveLength(7);

    for (const [id, modelId] of Object.entries(EXPECTED_CUSTOMER_IDS)) {
      const model = DIRECTORY_MODELS.find((candidate) => candidate.id === id);
      expect(model, `no catalog row with id ${id}`).toBeDefined();
      expect(model!.modelId).toBe(modelId);
      // The branded ID is a *different* string from the upstream slug — that
      // separation is the whole reason `modelId` exists next to `identifier`.
      expect(model!.identifier).not.toBe(modelId);
    }
  });

  it("keeps every customer ID unique and LUV13-branded", () => {
    const modelIds = DIRECTORY_MODELS.map((model) => model.modelId).filter(
      (value): value is string => Boolean(value),
    );

    expect(modelIds).toHaveLength(7);
    expect(new Set(modelIds).size).toBe(modelIds.length);
    for (const modelId of modelIds) {
      expect(modelId).toMatch(/^luv13\/[a-z0-9.-]+$/);
    }
  });

  it("renders the branded ID as a click-to-copy pane caption", () => {
    expect(MODEL_PANE_SLIDES).toHaveLength(7);

    for (const slide of MODEL_PANE_SLIDES) {
      const idRow = slide.meta.find((row) => row.label === "ID");
      expect(idRow, `${slide.title} has no ID caption`).toBeDefined();
      expect(idRow!.copy).toBe(true);
      expect(idRow!.value).toBe(slide.subtitle);
      expect(idRow!.value).toMatch(/^luv13\//);
    }
  });

  it("never prints an unbranded portal slug as a pane caption", () => {
    const portalSlugs = new Set(DIRECTORY_MODELS.map((m) => m.identifier));

    for (const slide of MODEL_PANE_SLIDES) {
      for (const row of slide.meta) {
        expect(portalSlugs.has(row.value), `${slide.title}: ${row.value}`).toBe(
          false,
        );
      }
    }
  });
});
