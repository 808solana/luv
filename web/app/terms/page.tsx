import { MarketingShell } from "@/components/marketing/marketing-shell";

export default function TermsPage() {
  return (
    <MarketingShell>
      <main className="bg-paper px-6 py-16 text-ink md:px-12 md:py-24">
        <article className="mx-auto max-w-2xl">
          <h1 className="text-3xl tracking-tight md:text-4xl">
            Terms of service
          </h1>
          <p className="mt-6 text-pretty text-base leading-relaxed text-black/70">
            We are still writing the public terms for LUV13 accounts and API
            access. This page is a placeholder so the footer link does not
            404. Until it ships, creating an account and using the API is
            governed by the agreement you accept at signup.
          </p>
        </article>
      </main>
    </MarketingShell>
  );
}
