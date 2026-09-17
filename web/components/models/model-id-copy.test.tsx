import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelIdCopy } from "@/components/models/model-id-copy";

/**
 * jsdom implements no clipboard API, so every test installs its own stub —
 * which is also the only way to tell which of `copyText()`'s two paths ran.
 */
function stubClipboard(impl?: (text: string) => Promise<void>) {
  const writeText = vi.fn(impl ?? (() => Promise.resolve()));
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

/** Click and flush the handler's microtasks, so no update lands outside act. */
async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el);
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ModelIdCopy", () => {
  it("copies the LUV13 ID from the ID text itself", async () => {
    const writeText = stubClipboard();
    render(<ModelIdCopy id="luv13/deepseek-v4-pro" />);

    // The visible text is the value, so the button is named for the action and
    // says which ID it copies.
    const control = screen.getByRole("button", {
      name: "Copy luv13/deepseek-v4-pro to clipboard",
    });
    expect(control).toHaveTextContent("luv13/deepseek-v4-pro");

    await click(control);

    expect(writeText).toHaveBeenCalledWith("luv13/deepseek-v4-pro");
    expect(screen.getByRole("status")).toHaveTextContent(
      "luv13/deepseek-v4-pro copied to clipboard",
    );
    expect(
      screen.getByRole("button", { name: "Model ID copied" }),
    ).toBeInTheDocument();
  });

  it("falls back to execCommand when the clipboard API rejects", async () => {
    stubClipboard(() => Promise.reject(new Error("NotAllowedError")));
    const execCommand = vi.fn(() => true);
    // jsdom has no `execCommand` and no real selection to satisfy it.
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });
    vi.spyOn(HTMLTextAreaElement.prototype, "select").mockImplementation(
      () => undefined,
    );

    render(<ModelIdCopy id="luv13/glm-5.3-flash" />);
    await click(
      screen.getByRole("button", {
        name: "Copy luv13/glm-5.3-flash to clipboard",
      }),
    );

    expect(execCommand).toHaveBeenCalledWith("copy");
    // The throwaway textarea is not left in the document.
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
  });

  it("keeps exactly one tab stop — the icon twin is hidden from AT", async () => {
    stubClipboard();
    render(<ModelIdCopy id="luv13/kimi-k3" />);

    // `byRole` walks the a11y tree, so the `aria-hidden` icon twin is absent:
    // one stop, one name, one action.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("type", "button");

    // Two controls are painted, but both run the same copy.
    await click(buttons[0]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "luv13/kimi-k3 copied to clipboard",
    );
  });

  it("clears the copied status after the 2000ms hold", async () => {
    stubClipboard();
    vi.useFakeTimers();
    render(<ModelIdCopy id="luv13/qwen-3.8-27b" />);

    await click(
      screen.getByRole("button", {
        name: "Copy luv13/qwen-3.8-27b to clipboard",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "luv13/qwen-3.8-27b copied to clipboard",
    );

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
