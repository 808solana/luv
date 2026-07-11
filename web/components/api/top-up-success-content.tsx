"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BalanceDisplay } from "@/components/api/balance-display";
import { FlowButton } from "@/components/ui/flow-button";

type TopUpSuccessContentProps = {
  amountCents: number;
};

function formatAmount(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function TopUpSuccessContent({ amountCents }: TopUpSuccessContentProps) {
  const router = useRouter();

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) return;

    const timer = setTimeout(() => router.push("/keys"), 3000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-lg font-medium text-black">
        You&apos;re topped up
        {amountCents > 0 ? ` — ${formatAmount(amountCents)} added` : ""}.
      </p>
      <BalanceDisplay />
      <p className="text-sm text-black/60">
        Redirecting to API keys in a few seconds…
      </p>
      <Link href="/keys" className="inline-flex">
        <FlowButton text="Back to API keys" />
      </Link>
    </div>
  );
}
