import { ProviderPane } from "@/components/marketing/provider-pane";
import { CyclingWords } from "@/components/ui/cycling-words";

const LUV_WITH_WORDS = ["Luv with everything down here", "Thanks"] as const;

export function UseNow() {
  return (
    <section
      id="use-now"
      aria-labelledby="use-now-heading"
      className="scroll-mt-[calc(var(--site-header-height)+0.75rem)] bg-white px-6 py-12 md:px-12 md:py-16"
    >
      <h2
        id="use-now-heading"
        aria-label="Luv with everything down here, Thanks"
        className="mb-8 flex flex-col items-center text-center font-helveticaneue-bold text-xl tracking-tight text-black text-balance sm:text-3xl md:mb-10 md:text-4xl"
      >
        <span aria-hidden="true" className="flex w-full flex-col items-center">
          <CyclingWords
            className="w-full"
            intervalMs={3000}
            words={LUV_WITH_WORDS}
          />
        </span>
      </h2>

      <p className="hero-neuralwatt mb-[30px] text-center">
        facts by openrouter.com
      </p>

      <ProviderPane />
    </section>
  );
}
