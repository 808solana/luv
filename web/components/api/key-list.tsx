"use client";

import { useCallback, useEffect, useState } from "react";

type KeyItem = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type KeyListProps = {
  refreshToken?: number;
};

export function KeyList({ refreshToken = 0 }: KeyListProps) {
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/keys");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setKeys(json.keys ?? []);
    } catch {
      setError("Could not load keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  if (loading) {
    return <p className="text-sm text-black/50">Loading keys…</p>;
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 text-sm text-black/80">
        <span>{error}</span>
        <button
          type="button"
          onClick={load}
          className="rounded-md font-semibold underline underline-offset-2 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (keys.length === 0) {
    return <p className="text-sm text-black/50">No keys yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="API keys">
      {keys.map((key) => (
        <li
          key={key.id}
          className="flex flex-col gap-1 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="font-semibold text-black">{key.name}</span>
          <div className="flex flex-wrap items-center gap-3 text-sm text-black/60">
            <span className="font-mono">{key.prefix}</span>
            <span>{formatDate(key.createdAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
