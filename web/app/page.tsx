import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { PillCta } from "@/components/marketing/pill-cta";
import { BaseUrlDisplay } from "@/components/ui/base-url-display";

export default function Home() {
  return (
    <MarketingShell overlayHeader>
      <main>
        <section
          id="hero"
          className="relative isolate min-h-dvh overflow-hidden bg-[#fe0000]"
        >
          <h1 className="sr-only">
            If you have a will to create, you&apos;re an artist
          </h1>
          <div className="absolute inset-0">
            <Image
              src="/BRAND_ASSETS/hero-home.jpg"
              alt="If you have a will to create, you're an artist. luv13, 2026."
              fill
              priority
              sizes="100vw"
              className="object-contain object-center"
            />
          </div>
        </section>

        <section id="models" className="relative z-10 -mt-12 bg-transparent">
          <div className="rounded-t-[48px] bg-[var(--section-cream)] px-6 py-20 md:px-12 md:py-28">
            <div className="mx-auto max-w-7xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 sm:text-xs">
                Models
              </p>
              <h2 className="mt-4 max-w-[20ch] text-3xl font-bold tracking-tight text-black text-balance md:text-4xl">
                Models we host
              </h2>
              <div className="mt-10 grid gap-4 md:grid-cols-2">
                <Link
                  href="/models"
                  className="group relative rounded-[32px] bg-white p-8 md:p-12"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 sm:text-xs">
                    Available
                  </p>
                  <h3 className="mt-4 text-2xl font-bold tracking-tight text-black md:text-[1.75rem]">
                    GLM-5.2
                  </h3>
                  <p className="mt-2 font-mono text-xs text-black/50">
                    luv13-glm-5.2
                  </p>
                  <p className="mt-4 text-sm font-medium text-black/70 tabular-nums">
                    $0.33 per 1M total tokens
                  </p>
                  <ChevronRight
                    className="absolute bottom-8 right-8 h-5 w-5 text-black md:bottom-12 md:right-12"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </Link>
                <div className="relative rounded-[32px] bg-[var(--section-mist)] p-8 md:p-12">
                  <span className="inline-flex rounded-full border border-black bg-white px-2.5 py-1 text-xs font-semibold text-black">
                    Coming soon
                  </span>
                  <h3 className="mt-4 text-2xl font-bold tracking-tight text-black md:text-[1.75rem]">
                    More models
                  </h3>
                  <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-black/70">
                    Each model will have its own flat rate. GLM-5.2 is live
                    today.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="bg-white px-6 py-20 md:px-12 md:py-28"
        >
          <div className="mx-auto max-w-7xl">
            <article className="rounded-[32px] bg-[var(--section-cream)] p-8 md:p-12">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 sm:text-xs">
                    Pricing
                  </p>
                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-black text-balance md:text-4xl">
                    Pay per token.{" "}
                    <span className="font-serif italic font-normal">
                      Nothing else.
                    </span>
                  </h2>
                </div>
                <div>
                  <p className="text-4xl font-helveticaneue-bold tracking-tight text-black tabular-nums md:text-5xl">
                    $0.33
                  </p>
                  <p className="mt-2 text-sm font-medium text-black/70">
                    per 1M total tokens
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="api" className="bg-white">
          <div className="rounded-t-[48px] bg-[var(--section-ink)] px-6 py-20 text-white md:px-12 md:py-28">
            <div className="mx-auto max-w-6xl text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 sm:text-xs">
                API access
              </p>
              <h2 className="mx-auto mt-4 max-w-[16ch] text-3xl font-helveticaneue-bold leading-[0.94] tracking-tight text-white text-balance md:text-5xl lg:text-6xl">
                Create your key.{" "}
                <span className="font-serif italic font-normal">Now.</span>
              </h2>
              <p className="mx-auto mt-6 max-w-md text-pretty text-base font-medium leading-relaxed text-white/70">
                Sign up with email, create an API key at $0, and add credit when
                you are ready to run GLM-5.2.
              </p>
              <div className="mt-10 flex justify-center">
                <BaseUrlDisplay />
              </div>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <PillCta href="/signup" className="min-h-12">
                  Create account
                </PillCta>
                <PillCta href="/login" variant="ghost" className="min-h-12">
                  Log in
                </PillCta>
              </div>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
