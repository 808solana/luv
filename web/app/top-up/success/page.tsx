import { TopUpSuccessContent } from "@/components/api/top-up-success-content";
import { ApiShell } from "@/components/api/api-shell";

type PageProps = {
  searchParams: Promise<{ amount?: string }>;
};

export default async function TopUpSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const amountCents = Number(params.amount ?? 0);

  return (
    <ApiShell title="Top up">
      <TopUpSuccessContent amountCents={Number.isFinite(amountCents) ? amountCents : 0} />
    </ApiShell>
  );
}
