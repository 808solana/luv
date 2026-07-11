"use client";

import { useCallback, useEffect, useState } from "react";
import { CopyField } from "@/components/ui/copy-field";
import { FlowButton } from "@/components/ui/flow-button";

const BASE_URL = "https://api.luv13.com/v1";

type CreatedKey = {
  id: string;
  name: string;
  key: string;
};

type KeyCreateFormProps = {
  onCreated?: () => void;
};

export function KeyCreateForm({ onCreated }: KeyCreateFormProps) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create key.");
      setCreated({ id: json.id, name: json.name, key: json.key });
      setName("");
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create key.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="key-name" className="text-xs font-bold uppercase tracking-[0.15em] text-black/60">
            Key name
          </label>
          <input
            id="key-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cursor, hermes, …"
            autoComplete="off"
            className="rounded-xl bg-white/20 px-4 py-2.5 text-sm text-black ring-1 ring-white/25 placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#675c56]"
          />
        </div>
        <FlowButton
          text={submitting ? "Creating…" : "Create"}
          type="submit"
          disabled={submitting || !name.trim()}
        />
      </form>

      {error && (
        <p className="text-sm text-[#b91c1c]" role="alert">
          {error}
        </p>
      )}

      {created && (
        <div
          className="flex flex-col gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15"
          role="region"
          aria-label="New API credentials"
        >
          <p className="text-sm font-medium text-black/80">
            Copy your key now — we will not show the full secret again.
          </p>
          <CopyField label="Base URL" value={BASE_URL} />
          <CopyField label="API key" value={created.key} />
        </div>
      )}
    </div>
  );
}
