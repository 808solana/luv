import { MarketingShell } from "@/components/marketing/marketing-shell";

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <main className="bg-paper px-6 py-16 text-ink md:px-12 md:py-24">
        <article className="mx-auto max-w-2xl">
          <h1 className="text-3xl tracking-tight md:text-4xl">
            Privacy notice
          </h1>
          <p className="mt-6 text-pretty text-base leading-relaxed text-black/70">
            We are still writing the public privacy notice for LUV13. This
            page is a placeholder so the footer link does not 404. Account
            email, session cookies, and usage needed to run the API are the
            data we handle today.
          </p>
        </article>
      </main>
    </MarketingShell>
  );
}
