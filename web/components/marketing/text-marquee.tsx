"use client";

import { DecryptText } from "@/components/ui/decrypt-text";
import { InfiniteSlider } from "@/components/ui/infinite-slider";
import { cn } from "@/lib/utils";

/** One repeatable unit. The trailing "|" is the separator between repeats. */
const PHRASE =
  "open-sourced | low price | ai models | hosted by Neuralwatt.com |";
const REPEATS = 5;
const GAP_PX = 28;
const DURATION_S = 72;

/**
 * Full-bleed band for the hero field: the phrase repeated, sliding endlessly.
 * No border, no band fill, no dots — it inherits the surface's text color and
 * reads as part of the page. Each unit also decrypts once on mount, so the
 * band arrives the same way the luv13 mark does while it is already sliding.
 */
export function TextMarquee({ className }: { className?: string }) {
  return (
    <div className={cn("w-full overflow-hidden py-6 md:py-8", className)}>
      <span className="sr-only">{PHRASE}</span>
      <div aria-hidden="true">
        <InfiniteSlider gap={GAP_PX} duration={DURATION_S}>
          {Array.from({ length: REPEATS }, (_, index) => (
            <DecryptText
              key={index}
              as="span"
              text={PHRASE}
              trigger="mount"
              loop={false}
              speed={40}
              stagger={22}
              startDelay={160}
              jitter={90}
              seed={7}
              className="shrink-0 font-sans text-[clamp(1.125rem,2.7vw,2.025rem)] leading-none tracking-tight whitespace-nowrap"
            />
          ))}
        </InfiniteSlider>
      </div>
    </div>
  );
}
