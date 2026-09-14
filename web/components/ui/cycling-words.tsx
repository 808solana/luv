"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type CyclingWordsProps = {
  words: readonly string[];
  intervalMs?: number;
  className?: string;
};

export function CyclingWords({
  words,
  intervalMs = 2000,
  className,
}: CyclingWordsProps) {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion || words.length < 2) {
      return;
    }

    const id = window.setTimeout(() => {
      setIndex((current) => (current + 1) % words.length);
    }, intervalMs);

    return () => window.clearTimeout(id);
  }, [index, intervalMs, reduceMotion, words.length]);

  const widest = words.reduce((longest, word) =>
    word.length >= longest.length ? word : longest,
  );
  const previous = (index - 1 + words.length) % words.length;

  return (
    <span
      className={cn(
        "relative inline-flex h-[2.4em] max-w-full items-center overflow-hidden align-baseline sm:h-[1.2em]",
        className,
      )}
    >
      <span className="invisible max-w-full text-center leading-tight whitespace-normal sm:whitespace-nowrap" aria-hidden>
        {widest}
      </span>
      {words.map((word, wordIndex) => (
        <motion.span
          key={word}
          aria-hidden={wordIndex !== index}
          className="absolute inset-0 flex items-center justify-center text-center leading-tight whitespace-normal sm:whitespace-nowrap"
          initial={false}
          animate={
            reduceMotion
              ? {
                  y: wordIndex === 0 ? "0%" : "110%",
                  opacity: wordIndex === 0 ? 1 : 0,
                }
              : {
                  y:
                    wordIndex === index
                      ? "0%"
                      : wordIndex === previous
                        ? "-110%"
                        : "110%",
                  opacity: wordIndex === index ? 1 : 0,
                }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 32, damping: 16 }
          }
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}
