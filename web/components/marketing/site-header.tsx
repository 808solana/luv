"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PillCta } from "@/components/marketing/pill-cta";
import { OverlayMenu } from "@/components/marketing/overlay-menu";

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header
        className={
          overlay
            ? "fixed inset-x-0 top-0 z-40 bg-transparent px-4 py-3 md:px-8"
            : "sticky top-0 z-40 bg-white/90 px-4 py-3 backdrop-blur-md md:px-8"
        }
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 md:gap-4">
          <Link
            href="/"
            className="flex min-h-11 shrink-0 items-center rounded-full focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#fff,0_0_0_5px_#0d0c12]"
            aria-label="LUV13 home"
          >
            <Image
              src="/BRAND_ASSETS/LUV13.png"
              alt="LUV13"
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
              priority
            />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <PillCta href="/login" size="sm">
              Log in
            </PillCta>
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black text-black transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.02] hover:shadow-[0_0_0_3px_#fff,0_0_0_4px_#0d0c12] active:scale-[0.96] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#fff,0_0_0_5px_#0d0c12]"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <span className="flex w-4 flex-col gap-1" aria-hidden="true">
                <span className="block h-px bg-black" />
                <span className="block h-px bg-black" />
                <span className="block h-px bg-black" />
              </span>
            </button>
          </div>
        </div>
      </header>
      <OverlayMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
