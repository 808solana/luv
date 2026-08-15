"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  type Variants,
} from "framer-motion";
import { Check, Copy } from "lucide-react";

const BASE_URL = "https://api.luv13.ai/v1";
const EASE = [0.16, 1, 0.3, 1] as const;

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.2 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export function BaseUrlDisplay() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(t);
  }, [inView]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(BASE_URL);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = BASE_URL;
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const iconTransition = { type: "spring" as const, duration: 0.3, bounce: 0 };

  return (
    <motion.div
      ref={ref}
      variants={container}
      initial="hidden"
      animate={visible ? "show" : "hidden"}
      className="flex items-center gap-2 rounded-2xl bg-white/15 px-5 py-3 sm:px-6 sm:py-4 ring-1 ring-white/20"
      aria-label={`Base URL: ${BASE_URL}`}
    >
      <div className="flex flex-col items-start gap-0.5">
        <motion.span
          variants={item}
          aria-hidden="true"
          className="select-none text-[10px] font-bold uppercase tracking-[0.2em] text-black/70 sm:text-xs"
        >
          Base URL
        </motion.span>
        <motion.span
          variants={item}
          className="select-text font-mono text-sm tracking-tight text-[#111111] sm:text-lg"
        >
          {BASE_URL}
        </motion.span>
      </div>
      <motion.button
        type="button"
        variants={item}
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy base URL to clipboard"}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#111111] transition-transform duration-200 hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] active:scale-[0.96]"
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
      </motion.button>
    </motion.div>
  );
}
