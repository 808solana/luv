"use client";

import { useRef, useEffect, type ReactNode } from "react";

type HolographicCardProps = {
  id?: string;
  className?: string;
  children: ReactNode;
  /**
   * Max tilt in degrees. Kept small so the tilt reads as subtle glass parallax,
   * not a flipping card. Default 6.
   */
  maxTilt?: number;
};

/**
 * HolographicCard
 *
 * Brand-adapted holographic / glass-morph card. Layers two pointer-driven
 * effects on top of the existing `.liquid-glass` surface:
 *   1. 3D parallax tilt that follows the cursor (perspective + rotateX/Y).
 *   2. A cursor-following radial glow overlay (brand-tinted, not neon).
 *
 * The wrapper itself is `rounded-2xl overflow-hidden` so the glow is always
 * clipped to the same rounded shape as the card — never a rectangle. The glow
 * fades out on mouse leave so it never lingers at the last cursor position.
 *
 * Pointer-only and gated on prefers-reduced-motion, so keyboard / touch users
 * get the static card. Drop-in wrapper: passes `children` straight through.
 */
export function HolographicCard({
  id,
  className,
  children,
  maxTilt = 6,
}: HolographicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) return;

    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -maxTilt;
      const rotateY = ((x - centerX) / centerX) * maxTilt;

      card.style.setProperty(
        "--glow-x",
        `${((x / rect.width) * 100).toFixed(2)}%`,
      );
      card.style.setProperty(
        "--glow-y",
        `${((y / rect.height) * 100).toFixed(2)}%`,
      );
      card.style.setProperty("--glow-opacity", "1");
      card.style.transition = "none";
      card.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(
        2,
      )}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    };

    const handleMouseLeave = () => {
      // Ease tilt back to neutral AND fade the glow out so it doesn't linger.
      card.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
      card.style.transition = "transform 400ms ease-out";
      card.style.setProperty("--glow-opacity", "0");
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [maxTilt]);

  return (
    <div
      ref={cardRef}
      className="relative h-full overflow-hidden rounded-2xl [transform-style:preserve-3d]"
      style={
        {
          transition: "transform 400ms ease-out",
          willChange: "transform",
          "--glow-opacity": "0",
        } as React.CSSProperties
      }
    >
      {/* Existing card surface + content (children = the <article> body) */}
      {children}
      {/* Cursor-following glow overlay — brand-tinted (#675c56), clipped to
          the wrapper's rounded shape, fades out on mouse leave. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            "radial-gradient(circle 140px at var(--glow-x, 50%) var(--glow-y, 50%), rgba(103, 92, 86, 0.35), transparent 60%)",
          opacity: "var(--glow-opacity, 0)",
          transition: "opacity 400ms ease-out",
          zIndex: 3,
        }}
      />
    </div>
  );
}

export default HolographicCard;
