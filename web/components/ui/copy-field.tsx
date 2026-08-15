"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";

type CopyFieldProps = {
  label: string;
  value: string;
  mono?: boolean;
};

const iconTransition = { type: "spring" as const, duration: 0.3, bounce: 0 };

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      /* no-op */
    }
    document.body.removeChild(ta);
  }
}

export function CopyField({ label, value, mono = true }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="flex items-center gap-2 rounded-2xl bg-white/15 px-5 py-3 sm:px-6 sm:py-4 ring-1 ring-white/20"
      aria-label={`${label}: ${value}`}
    >
      <div className="min-w-0 flex-1 flex flex-col items-start gap-0.5">
        <span
          aria-hidden="true"
          className="select-none text-[10px] font-bold uppercase tracking-[0.2em] text-black/70 sm:text-xs"
        >
          {label}
        </span>
        <span
          className={`select-text truncate text-sm tracking-tight text-[#111111] sm:text-base ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={
          copied ? "Copied" : `Copy ${label.toLowerCase()} to clipboard`
        }
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#111111] transition-transform duration-200 hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] active:scale-[0.96]"
      >
        <AnimatePresence initial={false} mode="popLayout">
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
                className="h-5 w-5 text-[#16a34a]"
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
              <Copy className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
