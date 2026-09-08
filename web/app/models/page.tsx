import { ModelDirectory } from "@/components/models/model-directory";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { DIRECTORY_MODELS } from "@/lib/models";

export default function ModelsPage() {
  return (
    <MarketingShell>
      <main className="bg-white px-4 py-10 text-black sm:px-6 md:py-16">
        <div className="mx-auto w-full max-w-6xl">
          <ModelDirectory models={DIRECTORY_MODELS} />
        </div>
      </main>
    </MarketingShell>
  );
}
