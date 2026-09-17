"use client";

import { useEffect } from "react";

const CONTENT_HASHES = new Set(["#models", "#use-now", "#pricing"]);

function isContentHash(hash: string) {
  return CONTENT_HASHES.has(hash);
}

function scrollToHash(hash: string) {
  const target = document.querySelector(hash);
  if (!(target instanceof HTMLElement)) return;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  window.dispatchEvent(new Event("luv:lenis-resize"));
  if (reduceMotion) {
    target.scrollIntoView();
    return;
  }
  const hasLenis = document.documentElement.classList.contains("lenis");
  if (hasLenis) {
    window.dispatchEvent(
      new CustomEvent("luv:scroll-to", { detail: { hash } }),
    );
    window.setTimeout(() => {
      if (Math.abs(target.getBoundingClientRect().top) > 120) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    }, 120);
    return;
  }
  target.scrollIntoView({ behavior: "smooth" });
}

export function HomeHashScroll() {
  useEffect(() => {
    const go = (hash = window.location.hash) => {
      if (!isContentHash(hash)) return;
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => scrollToHash(hash));
      });
      return () => window.cancelAnimationFrame(id);
    };

    const cancelInitial = go();

    const onHash = () => {
      go();
    };

    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === "_blank" || event.metaKey || event.ctrlKey) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname !== "/") return;
      if (!isContentHash(url.hash)) return;
      event.preventDefault();
      if (window.location.hash !== url.hash) {
        window.history.pushState(null, "", url.hash);
      }
      go(url.hash);
    };

    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    document.addEventListener("click", onClick, true);
    return () => {
      cancelInitial?.();
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
