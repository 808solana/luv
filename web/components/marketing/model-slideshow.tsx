import { IntelligenceChart } from "@/components/marketing/intelligence-chart";
import { ModelPane } from "@/components/marketing/model-pane";

export function ModelSlideshow() {
  return (
    <section
      id="models"
      aria-labelledby="models-heading"
      className="relative scroll-mt-[calc(var(--site-header-height)+0.75rem)] bg-white px-6 pb-10 pt-2 text-black md:px-12 md:pb-16 md:pt-3"
    >
      <div id="pricing" className="absolute -top-24 left-0 h-px w-px" />
      <h2 id="models-heading" className="hero-neuralwatt mb-[30px] text-center">
        Hosted By Neuralwatt.com
      </h2>
      {/* Single column at every width: the model list on top, then the
          Artificial Analysis comparison chart directly under it. */}
      <div className="mx-auto flex max-w-[88rem] flex-col gap-12 xl:max-w-[112rem] md:gap-16">
        <ModelPane />
        <IntelligenceChart />
      </div>
    </section>
  );
}
