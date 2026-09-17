"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";

import { copyText } from "@/lib/clipboard";

const BASE_URL = "https://api.luv13.ai/v1";

/**
 * Base URL shown in the hero as a compact white-on-red pill: the URL in plain
 * HelveticaNeue-Bold plus the copy button. It is deliberately the **same size**
 * as the "Get API Key" button next to it (both 44px tall, 14px label) — the
 * user asked for the two hero controls to be a matched pair (2026-09-15).
 *
 * The pill itself is fully transparent (`.liquid-glass-card` in globals.css:
 * `background: transparent` + `backdrop-filter: none`), so the red inside it is
 * pixel-identical to the red outside it — keep the type white, and do not turn
 * this into a solid white card with black text.
 */
export function BaseUrlDisplay() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyText(BASE_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const iconTransition = { type: "spring" as const, duration: 0.3, bounce: 0 };

  return (
    <div className="liquid-glass-card flex h-11 w-fit max-w-full items-center gap-1.5 rounded-full pl-4 pr-1">
      <span className="select-text font-sans text-sm leading-none tracking-tight text-paper">
        {BASE_URL}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy base URL to clipboard"}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-paper transition-transform duration-200 after:absolute after:-inset-1 after:content-[''] hover:bg-white/15 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.35),0_0_0_5px_#ffffff] active:scale-[0.96]"
      >
        <AnimatePresence initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
              transition={iconTransition}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Check
                className="h-4 w-4 text-[#22c55e]"
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
              transition={iconTransition}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Copy className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
