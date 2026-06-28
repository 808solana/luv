import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <header className="flex items-center px-6 py-6 md:px-12">
        <Image
          src="/BRAND_ASSETS/LUV13.png"
          alt="LUV13"
          width={120}
          height={40}
          priority
        />
      </header>

      <main className="flex flex-1 flex-col px-6 pb-24 md:px-12">
        <section className="pt-16 pb-20 md:pt-24 md:pb-28">
          <h1 className="text-5xl font-bold tracking-tight text-[#0d0c12] md:text-7xl lg:text-8xl">
            LUV13
          </h1>
          <p className="mt-6 max-w-xl text-xl font-normal leading-relaxed text-[#0d0c12] md:text-2xl">
            Hosting GLM-5.2. Low costs. Low prices.
          </p>
        </section>

        <section className="border-t border-[#0d0c12]/10 py-16 md:py-20">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#0d0c12]/60">
            What we do
          </h2>
          <p className="mt-6 max-w-2xl text-2xl font-normal leading-snug text-[#0d0c12] md:text-3xl">
            We host large language models. Right now, that is GLM-5.2. Because we
            keep our own costs low, we charge less.
          </p>
        </section>

        <section className="border-t border-[#0d0c12]/10 py-16 md:py-20">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#0d0c12]/60">
            Pricing
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-4xl font-bold text-[#0d0c12] md:text-5xl">
                $0.13
              </p>
              <p className="mt-2 text-base text-[#0d0c12]/70">
                per 1M input tokens
              </p>
            </div>
            <div>
              <p className="text-4xl font-bold text-[#0d0c12] md:text-5xl">
                $0.23
              </p>
              <p className="mt-2 text-base text-[#0d0c12]/70">
                per 1M output tokens
              </p>
            </div>
          </div>
        </section>

      </main>

      <footer className="px-6 py-8 md:px-12">
        <p className="text-sm text-[#0d0c12]/50">© {new Date().getFullYear()} LUV13</p>
      </footer>
    </div>
  );
}
