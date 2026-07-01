import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { WordsPullUp, WordsPullUpMultiStyle, FadeUp } from "@/components/words-pull-up";
import { ScrollFloat } from "@/components/scroll-float";
import { NotifyForm } from "@/components/notify-form";
import { HolographicCard } from "@/components/holographic-card";
import { FlowButton } from "@/components/ui/flow-button";
import { GlassEffect, GlassFilter } from "@/components/ui/liquid-glass";

const FEATURES = [
  {
    number: "01",
    title: "Hosted GLM-5.2.",
    intro: "One model, ready to call. No model selection, no routing config.",
    items: [
      "OpenAI-compatible /chat/completions endpoint",
      "Streaming and batch responses",
      "Consistent latency on owned hardware",
    ],
  },
  {
    number: "02",
    title: "Low costs. Low prices.",
    intro: "We run lean infrastructure and pass the savings through.",
    items: [
      "$0.13 per 1M input tokens",
      "$0.23 per 1M output tokens",
      "No platform fee, no minimum spend",
    ],
  },
  {
    number: "03",
    title: "API keys, soon.",
    intro: "We are opening direct access for coding agents and plugins.",
    items: [
      "Self-serve key generation",
      "Usage dashboards and quotas",
      "Drop-in for existing chat clients",
    ],
  },
];

export default function Home() {
  return (
    <div className="relative z-10 flex flex-col flex-1 text-black">
      {/* SECTION 1 — HERO */}
      <section id="hero" className="relative h-screen p-4 md:p-6">
        {/* Hero content removed */}
      </section>

      {/* SECTION 2 — ABOUT */}
      <section id="our-story" className="px-6 py-20 md:px-12 md:py-28">
        <GlassFilter />
        <div className="mx-auto max-w-6xl text-center">
          <GlassEffect
            className="rounded-[40px] px-8 py-16 md:px-16 md:py-24 flex flex-col items-center justify-center"
          >
            <WordsPullUpMultiStyle
              as="h2"
              className="mx-auto max-w-3xl text-3xl font-bold tracking-tight leading-[0.9] text-black sm:text-4xl sm:leading-[0.85] md:text-5xl lg:text-6xl xl:text-7xl"
              segments={[
                { text: "Start Creating" },
              ]}
            />
            <FadeUp delay={0.2} className="flex justify-center mt-[100px]">
              <FlowButton text="Api Key" />
            </FadeUp>
          </GlassEffect>
        </div>
      </section>

      {/* SECTION 3 — FEATURES */}
      <section
        id="the-model"
        className="relative overflow-hidden px-6 py-20 md:px-12 md:py-28"
      >
        <div className="mx-auto max-w-7xl">
          <WordsPullUpMultiStyle
            as="h2"
            className="max-w-4xl text-xl font-bold tracking-tight leading-tight text-black sm:text-2xl md:text-3xl lg:text-4xl"
            segments={[
              { text: "Simple hosting for one good model." },
              { text: "Low costs. Low prices. Nothing extra.", className: "text-black/40 font-normal" },
            ]}
          />

          <div className="mt-12 grid grid-cols-1 gap-3 sm:gap-2 md:grid-cols-2 md:gap-4 lg:grid-cols-3 lg:h-[480px]">
            {FEATURES.map((feature, i) => (
              <FadeUp key={feature.number} delay={i * 0.15}>
                <HolographicCard>
                  <article
                    id={feature.number === "03" ? "roadmap" : undefined}
                    className="relative z-[2] flex h-full flex-col rounded-2xl p-6 md:p-8 ring-1 ring-white/[0.08] [backdrop-filter:blur(4px)] [-webkit-backdrop-filter:blur(4px)]"
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#4e4f48]">
                        <ArrowRight
                          className="h-5 w-5 -rotate-45"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="text-xs font-bold tracking-widest text-black/40">
                        {feature.number}
                      </span>
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-black md:text-2xl">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-sm text-black/70">{feature.intro}</p>
                    <ul className="mt-6 flex flex-col gap-3">
                      {feature.items.map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <Check
                            className="mt-0.5 h-4 w-4 flex-shrink-0 text-black/60"
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                          <span className="text-sm text-black/80">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </HolographicCard>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 — PRICING & API ACCESS */}
      <section
        id="pricing"
        className="px-6 pb-20 md:px-12 md:pb-28"
      >
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
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-4xl font-bold tracking-tighter text-black md:text-5xl">$0.13</p>
                    <p className="mt-2 text-sm font-medium text-black/70">per 1M input tokens</p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold tracking-tighter text-black md:text-5xl">$0.23</p>
                    <p className="mt-2 text-sm font-medium text-black/70">per 1M output tokens</p>
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
                    text="Get notified when keys go live."
                    className="mt-4 text-2xl font-bold tracking-tight leading-tight text-black md:text-4xl"
                  />
                  <p className="mt-4 max-w-md text-sm font-medium text-black/70">
                    We are opening direct API keys for coding agents and LLM
                    plugins. Leave your email and we will let you know the moment
                    they are ready.
                  </p>
                </div>
                <div>
                  <NotifyForm />
                </div>
              </div>
            </article>
          </FadeUp>
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
  );
}
