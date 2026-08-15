import Image from "next/image";
import { WordsPullUp, FadeUp } from "@/components/words-pull-up";
import { FlowButton } from "@/components/ui/flow-button";
import { BaseUrlDisplay } from "@/components/ui/base-url-display";
import { SpecialText } from "@/components/ui/special-text";
import { GlassEffect, GlassFilter } from "@/components/ui/liquid-glass";
import { ScrollVideoBackground } from "@/components/scroll-video-background";
import { ModelDirectory } from "@/components/models/model-directory";
import { DIRECTORY_MODELS } from "@/lib/models";

export default function Home() {
  return (
    <>
      <ScrollVideoBackground src="https://video.korgems.com/stream/index.m3u8" />
      <div className="relative z-10 flex flex-col flex-1 text-black">
        {/* SECTION 1 — HERO */}
        <section id="hero" className="relative h-screen p-4 md:p-6">
          {/* Hero content removed */}
        </section>

        {/* SECTION 2 — ABOUT */}
        {/* SECTION 3 — FEATURES */}
        <section
          id="the-model"
          className="relative overflow-hidden px-6 py-20 md:px-12 md:py-28"
        >
          <div className="mx-auto max-w-7xl">
            <ModelDirectory models={DIRECTORY_MODELS} />
          </div>
        </section>

        {/* SECTION 4 — PRICING & API ACCESS */}
        <section id="pricing" className="px-6 pb-20 md:px-12 md:pb-28">
          <div className="mx-auto max-w-7xl flex flex-col gap-4">
            {/* Pricing card */}
            <FadeUp delay={0.15}>
              <article className="rounded-2xl p-8 md:p-12 ring-1 ring-white/[0.08] [backdrop-filter:blur(4px)] [-webkit-backdrop-filter:blur(4px)]">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 sm:text-xs">
                      Pricing
                    </p>
                    <WordsPullUp
                      as="h2"
                      text="Pay per token. Nothing else."
                      className="mt-4 text-2xl font-bold tracking-tight leading-tight text-black md:text-4xl"
                    />
                  </div>
                  <div>
                    <div>
                      <p className="text-4xl font-bold tracking-tighter text-black tabular-nums md:text-5xl">
                        $0.33
                      </p>
                      <p className="mt-2 text-sm font-medium text-black/70">
                        per 1M total tokens
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </FadeUp>

            {/* Notify card */}
            <FadeUp delay={0.15}>
              <article
                id="get-notified"
                className="rounded-2xl p-8 md:p-12 ring-1 ring-white/[0.08] [backdrop-filter:blur(4px)] [-webkit-backdrop-filter:blur(4px)]"
              >
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 sm:text-xs">
                      API access
                    </p>
                    <WordsPullUp
                      as="h3"
                      text="Create your key now."
                      className="mt-4 text-2xl font-bold tracking-tight leading-tight text-black md:text-4xl"
                    />
                    <p className="mt-4 max-w-md text-sm font-medium text-black/70">
                      Sign up with email, create an API key at $0, and add
                      credit when you are ready to run GLM-5.2.
                    </p>
                  </div>
                  <div className="flex md:justify-end">
                    <FlowButton text="Create account" href="/signup" />
                  </div>
                </div>
              </article>
            </FadeUp>
          </div>
        </section>

        {/* START CREATING */}
        <section id="our-story" className="px-6 py-20 md:px-12 md:py-28">
          <GlassFilter />
          <div className="mx-auto max-w-6xl text-center">
            <GlassEffect className="rounded-[40px] px-8 py-16 md:px-16 md:py-24 flex flex-col items-center justify-center">
              <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight leading-[0.9] text-black sm:text-4xl sm:leading-[0.85] md:text-5xl lg:text-6xl xl:text-7xl">
                <SpecialText
                  className="text-3xl font-bold tracking-tight leading-[0.9] text-black sm:text-4xl sm:leading-[0.85] md:text-5xl lg:text-6xl xl:text-7xl"
                  speed={20}
                  inView
                >
                  START CREATING
                </SpecialText>
              </h2>
              <FadeUp delay={0.2} className="flex justify-center mt-[60px]">
                <BaseUrlDisplay />
              </FadeUp>
              <FadeUp delay={0.35} className="flex justify-center mt-[40px]">
                <FlowButton text="Create account" href="/signup" />
              </FadeUp>
            </GlassEffect>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/10 px-6 py-8 md:px-12">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <Image
              src="/BRAND_ASSETS/LUV13.png"
              alt="LUV13"
              width={120}
              height={40}
              priority={false}
            />
            <p className="text-sm font-medium text-black/50">
              © {new Date().getFullYear()} LUV13
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
