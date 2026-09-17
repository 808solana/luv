"use client";

import { useEffect, useRef, useState } from "react";
import { CLIENT_PROVIDERS, type ClientProvider } from "@/lib/client-providers";
import { ShieldedImage } from "@/components/ui/shielded-image";

/**
 * The track repeats the client list 3× because the CSS loop translates by
 * exactly one period (`-100% / 3`): copies 2 and 3 only exist to fill the
 * viewport while copy 1 scrolls off.
 *
 * Those duplicates are `aria-hidden` + `tabIndex={-1}` so each client is
 * announced once and the tab order stays at one stop per client — but they are
 * **not** `inert`. `inert` also blocks pointer events, and since the duplicates
 * occupy most of the viewport for most of the loop that made the majority of
 * the visible row silently unclickable (reported 2026-09-15: "when I click on
 * Cursor, it doesn't open the app"). Every card on screen has to be a real
 * link; only the a11y tree and the tab order are deduplicated.
 *
 * `pr` in the track equals its flex `gap`, which makes the track width exactly
 * `copies × (items + gaps)` — that is what makes `-100% / 3` land on a period
 * instead of half a gap short.
 */
const COPIES = 3;

function ClientCard({
  provider,
  decorative,
}: {
  provider: ClientProvider;
  decorative: boolean;
}) {
  return (
    <a
      href={provider.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${provider.name} on OpenRouter`}
      data-decorative={decorative ? "true" : undefined}
      aria-hidden={decorative || undefined}
      tabIndex={decorative ? -1 : undefined}
      className="flex w-[29.4vw] shrink-0 snap-center flex-col items-center rounded-[20px] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#fff,0_0_0_5px_#0d0c12] sm:w-[9.1rem] lg:w-[10.5rem]"
    >
      <ShieldedImage
        src={provider.src}
        alt=""
        className="aspect-square w-full"
      />
      <span className="mt-4 text-center text-[15px] font-semibold tracking-tight text-black">
        {provider.name}
      </span>
    </a>
  );
}

/** Full-bleed auto-scrolling row of client marks + names. */
export function ClientMarquee() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [focusInRow, setFocusInRow] = useState(false);
  const [keyboardNav, setKeyboardNav] = useState(false);

  // An always-running animation that keeps ticking while the section is
  // off-screen steals frames from scroll on phones (smooth-scroll-fx.md #6).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry?.isIntersecting ?? true),
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // The row holds still only for **keyboard** users, who need the card they
  // have tabbed to not slide out from under them. Pointer focus must NOT pause
  // it: clicking a card focuses its `<a>` in Chrome/Firefox, and that used to
  // freeze the row until the user clicked elsewhere to blur it — reported
  // 2026-09-15 ("when I click on, let's say, Claude, I get opened in a new tab,
  // although then everything stops. The sliding just stops. I have to reclick
  // the website, and then it unstops").
  //
  // Input modality is tracked explicitly instead of leaning on `:focus-visible`
  // or `:focus-within` in CSS, because the `:focus-visible` heuristic depends on
  // the input source and the engine, and `:focus-within` cannot tell a click
  // from a Tab at all. Order is reliable: `pointerdown` fires *before* the focus
  // it causes, and `keydown` fires before the focus a Tab moves.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onPointerDown = () => setKeyboardNav(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") setKeyboardNav(true);
    };
    const onFocusIn = () => setFocusInRow(true);
    const onFocusOut = (event: FocusEvent) => {
      // Moving between two cards keeps focus inside the row; only a focus
      // destination outside it ends the hold.
      const next = event.relatedTarget as Node | null;
      if (!next || !el.contains(next)) setFocusInRow(false);
    };
    // Document-level, so the modality is current even when the last press
    // landed somewhere outside the row (e.g. tab in, click the email field,
    // then click a card).
    document.addEventListener("pointerdown", onPointerDown, true);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  const paused = !onScreen || !tabVisible || (focusInRow && keyboardNav);

  return (
    <div className="relative w-full">
      <div ref={viewportRef} className="client-marquee-viewport w-full">
        <div
          className="client-marquee flex w-max items-start gap-4 pr-4 sm:gap-6 sm:pr-6"
          data-paused={paused ? "true" : "false"}
        >
          {Array.from({ length: COPIES }, (_, copy) =>
            CLIENT_PROVIDERS.map((provider) => (
              <ClientCard
                key={`${copy}-${provider.id}`}
                provider={provider}
                decorative={copy > 0}
              />
            )),
          )}
        </div>
      </div>

      {/* Edge fades, so the row reads as endless instead of cut off. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-white to-transparent sm:w-24"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-white to-transparent sm:w-24"
      />
    </div>
  );
}
