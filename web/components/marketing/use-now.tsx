import { ClientMarquee } from "@/components/marketing/client-marquee";

export function UseNow() {
  return (
    <section
      id="use-now"
      aria-labelledby="use-now-heading"
      className="scroll-mt-[calc(var(--site-header-height)+0.75rem)] bg-white pt-12 pb-[140px] md:pt-16 md:pb-[150px]"
    >
      <h2
        id="use-now-heading"
        className="mb-8 px-6 text-center font-helveticaneue-bold text-xl leading-tight tracking-tight text-black text-balance sm:text-3xl md:mb-10 md:px-12 md:text-4xl"
      >
        Use With
      </h2>

      <ClientMarquee />
    </section>
  );
}
