import Link from "next/link";

import { HeroTitle } from "@/components/marketing/hero-title";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { ModelSlideshow } from "@/components/marketing/model-slideshow";
import { UseNow } from "@/components/marketing/use-now";
import { Contact16 } from "@/components/ui/contact-16";
import { HomeHashScroll } from "@/components/home-hash-scroll";
import { BaseUrlDisplay } from "@/components/ui/base-url-display";

export default function Home() {
  return (
    <MarketingShell overlayHeader>
      <HomeHashScroll />
      <main className="bg-white">
        <div className="home-hero-frame">
          <section
            id="hero"
            className="relative isolate px-6 pt-24 pb-8 md:pt-[min(24vh,13.5rem)] md:pb-10"
          >
            {/* Hero title: the `luv13` mark pops in, then flips through a 3D
                hinge cut to the Virgil Abloh line and back. See
                `hero-title.tsx` — the slot is a fixed 0.9em, so the pills below
                never move. */}
            <HeroTitle />
            {/* Two matched hero controls: the API-key CTA and the base URL.
                Both are the *same* transparent `.liquid-glass-card` pill — one
                44px box, one white 14px label, one drop shadow — so they are
                literally a single design. Keep them in lockstep. */}
            <div className="mx-auto mt-[31px] flex w-fit max-w-full flex-wrap items-center justify-center gap-3 md:mt-[39px]">
              <Link
                href="/signup"
                className="liquid-glass-card flex h-11 w-fit max-w-full items-center rounded-full px-4 transition duration-200 hover:bg-white/15 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(0,0,0,0.35),0_0_0_5px_#ffffff] active:scale-[0.96]"
              >
                <span className="select-none font-sans text-sm leading-none tracking-tight text-paper">
                  Get API Key
                </span>
              </Link>
              <BaseUrlDisplay />
            </div>
          </section>
        </div>

        <ModelSlideshow />

        <UseNow />

        <Contact16 />
      </main>
    </MarketingShell>
  );
}
