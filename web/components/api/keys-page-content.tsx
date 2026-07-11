"use client";

import { useState } from "react";
import Link from "next/link";
import { BalanceDisplay, useBalance } from "@/components/api/balance-display";
import { KeyCreateForm } from "@/components/api/key-create-form";
import { KeyList } from "@/components/api/key-list";
import { FlowButton } from "@/components/ui/flow-button";

export function KeysPageContent() {
  const { data: balance, refresh } = useBalance();
  const [refreshToken, setRefreshToken] = useState(0);

  const canCreate =
    balance !== null && balance.balanceCents >= balance.minBalanceCents;

  const handleCreated = () => {
    setRefreshToken((n) => n + 1);
    refresh();
  };

  return (
    <div className="flex flex-col gap-8">
      <BalanceDisplay onBalanceChange={() => refresh()} />

      {!balance ? (
        <p className="text-sm text-black/50">Loading…</p>
      ) : canCreate ? (
        <section aria-labelledby="create-key-heading" className="flex flex-col gap-4">
          <h2 id="create-key-heading" className="text-lg font-bold text-black">
            Create API key
          </h2>
          <KeyCreateForm onCreated={handleCreated} />
        </section>
      ) : (
        <section className="flex flex-col items-start gap-4">
          <p className="text-sm text-black/70">
            Add at least{" "}
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: balance.currency,
            }).format(balance.minBalanceCents / 100)}{" "}
            to your balance before creating a key.
          </p>
          <Link href="/top-up" className="inline-flex">
            <FlowButton text="Top up" />
          </Link>
        </section>
      )}

      <section aria-labelledby="keys-list-heading" className="flex flex-col gap-3">
        <h2 id="keys-list-heading" className="text-lg font-bold text-black">
          Your keys
        </h2>
        <KeyList refreshToken={refreshToken} />
      </section>

      <p className="text-xs text-black/50">
        Works with Hermes, OpenCode, Cursor, Kilo
      </p>
    </div>
  );
}
