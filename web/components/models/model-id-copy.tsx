"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";

import { copyText } from "@/lib/clipboard";

/**
 * How long the copied state holds before the icon falls back. 2000ms is the
 * house value — the hero base-URL pill and the contact e-mail row both use it.
 */
const COPIED_HOLD_MS = 2000;

/** The copy icon↔check swap, matching the hero pill and the contact row. */
const ICON_TRANSITION = {
  type: "spring" as const,
  duration: 0.3,
  bounce: 0,
};

/**
 * A model's customer-facing LUV13 ID as a click-to-copy control.
 *
 * This is the contact section's e-mail row (`contact-16.tsx`) at `#models`
 * pane-row scale, and it keeps that row's two-control shape for the same
 * reason:
 *
 * - The **ID text is the control**. Its visible text is already the value, so
 *   there is nothing to guess at, and `select-text` keeps it hand-copyable.
 * - The **icon is a pointer-sized twin** of the same action, and is
 *   `aria-hidden` + `tabIndex={-1}` because the text button already exposes it
 *   — leaving it focusable would give keyboard users two stops, two names and
 *   one action. A `role="status"` `sr-only` line is therefore what announces
 *   the copy.
 *
 * **It is deliberately smaller than the site's 44px control floor.** The row's
 * meta line is `text-[7.728px]` / `sm:text-[9.66px]`, so a 44px target would
 * span most of the 90px row and swallow taps meant for the title, the
 * `Modalities` line and the `Open` pill under it. Worse, a taller *face* would
 * grow the meta line and so every pane row (the rows are mark-height, 89.97px
 * at `sm`+). So the face stays inside the line box (`size-[13px]` /
 * `sm:size-4`) and the invisible `::after` box carries the target instead —
 * ~29px / ~32px, as big as this scale allows without changing the row.
 *
 * Shared helper on purpose: `copyText()` in `lib/clipboard.ts`, never a fourth
 * inline copy with its own `execCommand` fallback. See
 * `.cursor/skills/frontend/copy-to-clipboard-component.md`.
 */
export function ModelIdCopy({ id }: { id: string }) {
  const [copied, setCopied] = React.useState(false);

  // Keyed on the flag, so the timer is cleared on unmount.
  React.useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    await copyText(id);
    setCopied(true);
  };

  return (
    <span className="inline-flex items-center gap-x-[3px] sm:gap-x-[3.864px]">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Model ID copied" : `Copy ${id} to clipboard`}
        className="cursor-pointer rounded-full font-mono font-medium text-black/70 transition-colors duration-200 select-text hover:text-black focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0d0c12] motion-reduce:transition-none"
      >
        {id}
      </button>

      <button
        type="button"
        onClick={handleCopy}
        aria-hidden="true"
        tabIndex={-1}
        className="relative flex size-[13px] shrink-0 cursor-pointer items-center justify-center rounded-full text-black/45 transition-transform duration-200 after:absolute after:-inset-2 after:content-[''] hover:bg-black/5 active:scale-[0.96] focus-visible:outline-none sm:size-4"
      >
        <AnimatePresence initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
              transition={ICON_TRANSITION}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Check
                className="size-[9px] text-[#22c55e] sm:size-[11px]"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
              transition={ICON_TRANSITION}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Copy
                className="size-[9px] sm:size-[11px]"
                strokeWidth={2}
                aria-hidden="true"
              />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <span role="status" className="sr-only">
        {copied ? `${id} copied to clipboard` : ""}
      </span>
    </span>
  );
}
