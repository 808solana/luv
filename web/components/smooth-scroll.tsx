"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Desktop smooth wheel — Lenis is intentionally **not** booted on touch.
 *
 * Mobile choppiness came from Lenis's `syncTouch`, which prevented the native
 * gesture and drove `scrollTo` from the main thread every frame. iOS/Android
 * momentum scroll is compositor-driven and already the smoothest scroll the
 * device can produce, so touch devices keep it and we only add wheel inertia
 * for a fine, hover-capable pointer. `syncTouch: false` also means hybrid
 * touchscreen laptops keep native touch while their wheel stays smoothed.
 */

/** Primary input is a mouse/trackpad, not a finger. */
const FINE_POINTER = "(hover: hover) and (pointer: fine)";

export function SmoothScroll() {
  useEffect(() => {
    const root = document.documentElement;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      root.dataset.scroll = "reduced";
      return;
    }

    // Touch devices: hand scrolling to the OS. No rAF loop, no listeners.
    if (!window.matchMedia(FINE_POINTER).matches) {
      root.dataset.scroll = "native-touch";
      return;
    }

    const lenis = new Lenis({
      // Soft, buttery wheel inertia — not sluggish
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Never hijack touch; native momentum beats JS smoothing on every device.
      syncTouch: false,
      wheelMultiplier: 0.92,
      autoResize: true,
    });

    root.dataset.scroll = "lenis";
    document.documentElement.classList.add("lenis", "lenis-smooth");

    const onResize = () => lenis.resize();
    const onScrollTo = (event: Event) => {
      const hash = (event as CustomEvent<{ hash?: string }>).detail?.hash;
      if (!hash) return;
      const target = document.querySelector(hash);
      if (!(target instanceof HTMLElement)) return;
      lenis.resize();
      lenis.scrollTo(target, { offset: -72, duration: 1.15 });
    };

    window.addEventListener("luv:lenis-resize", onResize);
    window.addEventListener("luv:scroll-to", onScrollTo);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("luv:lenis-resize", onResize);
      window.removeEventListener("luv:scroll-to", onScrollTo);
      document.documentElement.classList.remove("lenis", "lenis-smooth");
      lenis.destroy();
    };
  }, []);

  return null;
}

export default SmoothScroll;
