"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

const wordVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: { duration: 0.6, ease: EASE, delay: i * 0.08 },
  }),
};

type WordsPullUpProps = {
  text: string;
  className?: string;
  showAsterisk?: boolean;
  as?: "h1" | "h2" | "h3" | "p" | "div" | "span";
  delay?: number;
};

export function WordsPullUp({
  text,
  className,
  showAsterisk = false,
  as = "div",
  delay = 0,
}: WordsPullUpProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const words = text.split(" ");
  const MotionTag = motion[as];

  return (
    <MotionTag
      ref={ref as never}
      className={className}
      aria-label={text}
      animate={inView ? "visible" : "hidden"}
      initial="hidden"
    >
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        const needsAsterisk = showAsterisk && isLast;
        return (
          <span key={`${word}-${i}`} className="inline-flex items-start">
            <motion.span
              className="inline-block"
              variants={wordVariants}
              custom={i + delay / 0.08}
            >
              {word}
            </motion.span>
            {needsAsterisk && (
              <motion.span
                aria-hidden="true"
                className="relative -right-[0.18em] top-[0.62em] text-[0.31em] font-normal"
                variants={wordVariants}
                custom={i + delay / 0.08}
              >
                *
              </motion.span>
            )}
            {!isLast && (
              <motion.span
                className="inline-block"
                variants={wordVariants}
                custom={i + delay / 0.08}
              >
                &nbsp;
              </motion.span>
            )}
          </span>
        );
      })}
    </MotionTag>
  );
}

type Segment = {
  text: string;
  className?: string;
};

type WordsPullUpMultiStyleProps = {
  segments: Segment[];
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "div" | "span";
  delay?: number;
};

export function WordsPullUpMultiStyle({
  segments,
  className,
  as = "div",
  delay = 0,
}: WordsPullUpMultiStyleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const words: Array<{ word: string; className?: string }> = [];
  segments.forEach((seg) => {
    const parts = seg.text.split(" ").filter(Boolean);
    parts.forEach((w) => words.push({ word: w, className: seg.className }));
  });

  const MotionTag = motion[as];

  return (
    <MotionTag
      ref={ref as never}
      className={className}
      aria-label={segments.map((s) => s.text).join(" ")}
      animate={inView ? "visible" : "hidden"}
      initial="hidden"
    >
      <span className="inline-flex flex-wrap justify-center">
        {words.map((w, i) => (
          <span key={`${w.word}-${i}`} className="inline-flex items-start">
            <motion.span
              className={`inline-block ${w.className ?? ""}`}
              variants={wordVariants}
              custom={i + delay / 0.08}
            >
              {w.word}
            </motion.span>
            {i < words.length - 1 && (
              <motion.span
                className="inline-block"
                variants={wordVariants}
                custom={i + delay / 0.08}
              >
                &nbsp;
              </motion.span>
            )}
          </span>
        ))}
      </span>
    </MotionTag>
  );
}

const fadeUpVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: (delay: number) => ({
    y: 0,
    opacity: 1,
    transition: { duration: 0.7, ease: EASE, delay },
  }),
};

export function FadeUp({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={fadeUpVariants}
      custom={delay}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}
