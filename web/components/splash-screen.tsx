"use client";

import { useEffect } from "react";

const MIN_MS = 220;
const EXIT_MS = 720;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function waitForLoad() {
  return new Promise<void>((resolve) => {
    if (document.readyState === "complete") {
      resolve();
      return;
    }
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

export function SplashScreen() {
  useEffect(() => {
    const overlay = document.getElementById("luv13-splash");
    if (!overlay || overlay.dataset.dismissed === "true") {
      document.documentElement.classList.add("splash-done");
      return;
    }

    const started = performance.now();
    let removed = false;

    const remove = () => {
      if (removed) return;
      removed = true;
      overlay.dataset.dismissed = "true";
      overlay.remove();
      document.documentElement.classList.add("splash-done");
    };

    const dismiss = async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready.catch(() => undefined);
      }
      await waitForLoad();
      const elapsed = performance.now() - started;
      const wait = Math.max(0, MIN_MS - elapsed);
      if (wait) {
        await new Promise((resolve) => window.setTimeout(resolve, wait));
      }

      if (prefersReducedMotion()) {
        remove();
        return;
      }

      overlay.classList.add("is-exiting");
      overlay.addEventListener("transitionend", remove, { once: true });
      window.setTimeout(remove, EXIT_MS);
    };

    void dismiss();
  }, []);

  return null;
}
