"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { PillCta } from "@/components/marketing/pill-cta";

type OverlayMenuProps = {
  open: boolean;
  onClose: () => void;
};

const explore = [
  { href: "/#models", label: "Models" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#api", label: "API" },
  { href: "/dashboard", label: "Dashboard" },
];

const services = [
  { href: "/#models", title: "GLM-5.2", meta: "$0.33 / 1M tokens" },
  { href: "/dashboard", title: "API keys", meta: "Create at $0" },
  { href: "/top-up", title: "Top up", meta: "Pay-as-you-go credit" },
];

export function OverlayMenu({ open, onClose }: OverlayMenuProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 p-3 md:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto rounded-[32px] bg-white px-6 py-6 text-black shadow-[0_20px_70px_rgba(0,0,0,0.18)] md:px-8"
      >
        <div className="flex items-center justify-between gap-4">
          <h2
            id={titleId}
            className="font-serif text-4xl font-normal tracking-tight text-black md:text-[2.75rem]"
          >
            Menu
          </h2>
          <div className="flex items-center gap-2">
            <PillCta href="/login" size="sm" onClick={onClose}>
              Log in
            </PillCta>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-black text-black transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.02] hover:shadow-[0_0_0_3px_#fff,0_0_0_4px_#0d0c12] active:scale-[0.96] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#fff,0_0_0_5px_#0d0c12]"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 sm:text-xs">
          Explore
        </p>
        <nav className="mt-4 flex flex-col" aria-label="Site">
          {explore.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={onClose}
              className="flex min-h-14 items-center justify-between text-lg font-medium text-black transition-opacity hover:opacity-60"
            >
              {item.label}
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </Link>
          ))}
        </nav>

        <p className="mt-10 text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 sm:text-xs">
          Models
        </p>
        <div className="mt-4 grid gap-3">
          {services.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              onClick={onClose}
              className="rounded-[24px] bg-[var(--section-cream)] px-5 py-5 transition-opacity hover:opacity-80"
            >
              <p className="text-lg font-bold tracking-tight">{card.title}</p>
              <p className="mt-1 text-sm font-medium text-black/70">
                {card.meta}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-auto pt-10">
          <PillCta href="/signup" className="w-full" onClick={onClose}>
            Create account
          </PillCta>
        </div>
      </aside>
    </div>
  );
}
