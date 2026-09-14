"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { LOGOS } from "@/components/ui/logo-clouds-utils/logos";

export type LogoEntry = {
  icon?: React.ReactNode;
  src?: string;
  alt?: string;
  name?: string;
  id?: string;
};

export type LogoCloudSwapProps = {
  logos?: LogoEntry[];
  title?: string;
  subtitle?: string;
  interval?: number;
  stagger?: number;
  className?: string;
};

const WIPE_DURATION = 0.92;
const WIPE_TIMES = [0, 0.4, 1];

const DEFAULT_LOGOS: LogoEntry[] = LOGOS.map((l) => ({
  src: l.src,
  alt: l.alt,
  name: l.name,
  id: l.id,
}));

function LogoMark({ logo }: { logo: LogoEntry }) {
  if (logo.src) {
    return (
      <span className="relative flex size-9 overflow-hidden rounded-full bg-white outline outline-1 outline-black/10 sm:size-10">
        <Image
          src={logo.src}
          alt={logo.alt ?? logo.name ?? ""}
          fill
          sizes="40px"
          className="select-none object-contain p-[18%]"
        />
      </span>
    );
  }

  return (
    <span className="flex size-9 items-center justify-center sm:size-10">
      {logo.icon}
    </span>
  );
}

function LogoItem({
  logo,
  index,
  isWaving,
  stagger,
  totalCount,
  onDone,
}: {
  logo: LogoEntry;
  index: number;
  isWaving: boolean;
  stagger: number;
  totalCount: number;
  onDone: () => void;
}) {
  return (
    <motion.div
      aria-label={logo.name ?? "Logo"}
      animate={
        isWaving
          ? {
              clipPath: [
                "inset(0 0% 0 0)",
                "inset(0 100% 0 0)",
                "inset(0 0% 0 0)",
              ],
              filter: ["blur(0px)", "blur(8px)", "blur(0px)"],
              opacity: [1, 0.2, 1],
            }
          : {
              clipPath: "inset(0 0% 0 0)",
              filter: "blur(0px)",
              opacity: 1,
            }
      }
      transition={
        isWaving
          ? {
              clipPath: {
                duration: WIPE_DURATION,
                times: WIPE_TIMES,
                ease: ["easeIn", [0.16, 1, 0.3, 1]],
                delay: index * stagger,
              },
              filter: {
                duration: WIPE_DURATION * 0.9,
                times: WIPE_TIMES,
                ease: "easeInOut" as const,
                delay: index * stagger,
              },
              opacity: {
                duration: WIPE_DURATION * 0.85,
                times: WIPE_TIMES,
                ease: "easeInOut" as const,
                delay: index * stagger,
              },
            }
          : {
              duration: 0.3,
              ease: "easeOut",
            }
      }
      onAnimationComplete={() => {
        if (isWaving && index === totalCount - 1) onDone();
      }}
      whileHover={{
        scale: 1.07,
        opacity: 1,
        filter: "blur(0px)",
        transition: { type: "spring", stiffness: 340, damping: 24, bounce: 0 },
      }}
      className="flex w-[4.5rem] shrink-0 cursor-default flex-col items-center gap-2 sm:w-[5.625rem]"
    >
      <LogoMark logo={logo} />
      {logo.name ? (
        <span className="select-none whitespace-nowrap text-[10px] font-medium tracking-wide text-black/50 sm:text-[11px]">
          {logo.name}
        </span>
      ) : null}
    </motion.div>
  );
}

export default function LogoCloudSwap({
  logos = DEFAULT_LOGOS,
  title,
  subtitle,
  interval = 3200,
  stagger = 0.11,
  className,
}: LogoCloudSwapProps) {
  const [waving, setWaving] = React.useState(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setWaving(true), interval);
    return () => clearInterval(id);
  }, [interval, reduceMotion]);

  return (
    <div className={cn("w-full bg-white px-4 py-8 sm:py-10", className)}>
      {title || subtitle ? (
        <div className="mx-auto max-w-2xl text-center">
          {title ? (
            <h2 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="mt-3 text-sm text-black/55">{subtitle}</p>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "mx-auto max-w-5xl",
          title || subtitle ? "mt-10 sm:mt-12" : null,
        )}
      >
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 lg:gap-10">
          {logos.map((logo, i) => (
            <LogoItem
              key={logo.id ?? i}
              logo={logo}
              index={i}
              isWaving={waving}
              stagger={stagger}
              totalCount={logos.length}
              onDone={() => setWaving(false)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
