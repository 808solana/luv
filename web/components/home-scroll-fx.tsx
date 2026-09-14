"use client";

import { useEffect, useRef } from "react";

/**
 * Simple scroll-linked motion for the home hero:
 * title + CTA ease up and fade as you scroll past the first screen.
 * Uses rAF-smoothed progress so it stays buttery with Lenis on desktop + touch.
 */
export function HomeScrollFx({ children }: { children: React.ReactNode }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const currentRef = useRef(0);
  const targetRef = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const layer = layerRef.current;
    if (!layer) return;

    const measure = () => {
      const max = Math.max(window.innerHeight * 0.72, 1);
      targetRef.current = Math.min(1, Math.max(0, window.scrollY / max));
    };

    const tick = () => {
      // Ease toward target — feels smooth even when scroll jumps
      currentRef.current += (targetRef.current - currentRef.current) * 0.12;
      const p = currentRef.current;

      const y = p * -56; // gentle rise
      const opacity = 1 - p * 0.85;
      const scale = 1 - p * 0.04;

      layer.style.transform = `translate3d(0, ${y}px, 0) scale(${scale})`;
      layer.style.opacity = String(Math.max(0, opacity));

      if (Math.abs(targetRef.current - currentRef.current) > 0.0004) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        currentRef.current = targetRef.current;
        frameRef.current = 0;
      }
    };

    const onScroll = () => {
      measure();
      if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    measure();
    tick();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div
      ref={layerRef}
      className="will-change-transform"
      style={{ transformOrigin: "50% 40%" }}
    >
      {children}
    </div>
  );
}
