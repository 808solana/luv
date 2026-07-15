"use client";

import { useCallback, useEffect, useState } from "react";

type BalanceData = {
  balanceCents: number;
  currency: string;
  minBalanceCents: number;
};

function formatCents(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function BalanceDisplay() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/balance");
      if (!res.ok) throw new Error("Could not load balance.");
      setData((await res.json()) as BalanceData);
    } catch {
      setError("Could not load balance.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="flex items-center gap-3 text-sm text-black/80">
        <span>{error}</span>
        <button
          type="button"
          onClick={load}
          className="rounded-md px-2 py-1 font-semibold underline underline-offset-2 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <p className="text-sm font-medium text-black/70" aria-live="polite">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/50 sm:text-xs">
        Balance{" "}
      </span>
      <span className="text-lg font-bold text-black sm:text-xl">
        {data ? formatCents(data.balanceCents, data.currency) : "—"}
      </span>
      <span className="ml-1 text-black/60">available</span>
    </p>
  );
}

export function useBalance() {
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/balance");
      if (!res.ok) throw new Error();
      setData((await res.json()) as BalanceData);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh };
}
