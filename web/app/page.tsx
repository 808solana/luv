import { MarketingShell } from "@/components/marketing/marketing-shell";
import { ModelSlideshow } from "@/components/marketing/model-slideshow";
import { TextMarquee } from "@/components/marketing/text-marquee";
import { UseNow } from "@/components/marketing/use-now";
import { DecryptText } from "@/components/ui/decrypt-text";
import { HomeHashScroll } from "@/components/home-hash-scroll";
import { PillCta } from "@/components/marketing/pill-cta";
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
            <DecryptText
              as="h1"
              text="luv13"
              trigger="mount"
              loop={false}
              speed={38}
              stagger={115}
              startDelay={220}
              jitter={60}
              seed={13}
              className="text-center font-sans text-[5.625rem] leading-[0.9] tracking-tight text-paper md:text-[9rem] lg:text-[12rem]"
            />
          </section>
          <TextMarquee className="text-paper" />
        </div>

        <ModelSlideshow />

        <UseNow />

        <section id="api" className="scroll-mt-[calc(var(--site-header-height)+0.75rem)] bg-white px-6 py-14 md:px-12 md:py-20">
          <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
            <BaseUrlDisplay />
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PillCta href="/signup" className="min-h-12">
                Create account
              </PillCta>
              <PillCta href="/login" variant="ghost" className="min-h-12">
                Log in
              </PillCta>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
