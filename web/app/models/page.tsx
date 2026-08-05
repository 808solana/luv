import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModelDirectory } from "@/components/models/model-directory";
import { DIRECTORY_MODELS } from "@/lib/models";

export default function ModelsPage() {
  return (
    <main className="min-h-full bg-white px-4 py-10 text-black sm:px-6 md:py-16">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-black transition-colors hover:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Back to home
        </Link>
        <div className="mt-8">
          <ModelDirectory models={DIRECTORY_MODELS} />
        </div>
      </div>
    </main>
  );
}
