"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

import { cn } from "@/lib/utils";

const SPRING_CONFIG = { damping: 28, stiffness: 260 };

type MagneticButtonProps = {
  children: ReactNode;
  /** How far the child follows the pointer. 0.25–0.35 stays mild. */
  distance?: number;
  className?: string;
};

function MagneticButton({
  children,
  distance = 0.28,
  className,
}: MagneticButtonProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const rest = useRef({
    centerX: 0,
    centerY: 0,
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  });

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, SPRING_CONFIG);
  const springY = useSpring(y, SPRING_CONFIG);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const captureRest = () => {
    if (!ref.current) {
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const tx = x.get();
    const ty = y.get();
    rest.current = {
      centerX: rect.left + rect.width / 2 - tx,
      centerY: rect.top + rect.height / 2 - ty,
      left: rect.left - tx,
      top: rect.top - ty,
      right: rect.right - tx,
      bottom: rect.bottom - ty,
    };
  };

  const apply = (clientX: number, clientY: number) => {
    if (reduceMotion || !ref.current) {
      x.set(0);
      y.set(0);
      return;
    }

    const nextX = (clientX - rest.current.centerX) * distance;
    const nextY = (clientY - rest.current.centerY) * distance;
    const bounds = ref.current
      .closest("[data-magnetic-bounds]")
      ?.getBoundingClientRect();

    if (!bounds) {
      x.set(nextX);
      y.set(nextY);
      return;
    }

    x.set(
      Math.min(
        bounds.right - rest.current.right,
        Math.max(bounds.left - rest.current.left, nextX),
      ),
    );
    y.set(
      Math.min(
        bounds.bottom - rest.current.bottom,
        Math.max(bounds.top - rest.current.top, nextY),
      ),
    );
  };

  return (
    <motion.div
      ref={ref}
      className={cn("inline-flex", className)}
      onMouseEnter={(event) => {
        if (reduceMotion) {
          return;
        }
        captureRest();
        apply(event.clientX, event.clientY);
      }}
      onMouseMove={(event) => {
        if (reduceMotion) {
          return;
        }
        apply(event.clientX, event.clientY);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={reduceMotion ? undefined : { x: springX, y: springY }}
    >
      {children}
    </motion.div>
  );
}

export { MagneticButton };
