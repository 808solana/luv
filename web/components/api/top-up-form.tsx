"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Wallet } from "lucide-react";
import { FlowButton } from "@/components/ui/flow-button";

const PRESETS = [
  { label: "$5", cents: 500 },
  { label: "$10", cents: 1000 },
  { label: "$25", cents: 2500 },
] as const;

type PaymentMethod = "card" | "usdc" | "apple" | "google" | "paypal";

const METHODS: { id: PaymentMethod; label: string; description: string }[] = [
  { id: "card", label: "Credit / Debit Card", description: "Visa, Mastercard, Amex" },
  { id: "usdc", label: "USDC Crypto", description: "Pay with USDC on supported networks" },
];

const QUICK_PAY: { id: PaymentMethod; label: string }[] = [
  { id: "apple", label: "Apple Pay" },
  { id: "google", label: "Google Pay" },
  { id: "paypal", label: "PayPal" },
];

export function TopUpForm() {
  const router = useRouter();
  const [selectedCents, setSelectedCents] = useState(500);
  const [customMode, setCustomMode] = useState(false);
  const [customDollars, setCustomDollars] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = customMode
    ? Math.round(parseFloat(customDollars || "0") * 100)
    : selectedCents;

  const handleTopUp = async () => {
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError("Enter a valid amount.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/top-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, method }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Top up failed.");
      router.push(`/top-up/success?amount=${amountCents}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Top up failed.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-bold uppercase tracking-[0.15em] text-black/60">
          Amount
        </legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.cents}
              type="button"
              onClick={() => {
                setCustomMode(false);
                setSelectedCents(preset.cents);
              }}
              aria-pressed={!customMode && selectedCents === preset.cents}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] ${
                !customMode && selectedCents === preset.cents
                  ? "bg-white/40 text-black ring-1 ring-white/30"
                  : "bg-white/15 text-black/80 hover:bg-white/25"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomMode(true)}
            aria-pressed={customMode}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] ${
              customMode
                ? "bg-white/40 text-black ring-1 ring-white/30"
                : "bg-white/15 text-black/80 hover:bg-white/25"
            }`}
          >
            Custom
          </button>
        </div>
        {customMode && (
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">Custom amount in dollars</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={customDollars}
              onChange={(e) => setCustomDollars(e.target.value)}
              placeholder="0.00"
              className="w-full max-w-[160px] rounded-xl bg-white/20 px-4 py-2.5 text-sm text-black ring-1 ring-white/25 placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#675c56]"
            />
          </label>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-xs font-bold uppercase tracking-[0.15em] text-black/60">
          Payment method
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              aria-pressed={method === m.id}
              className={`flex items-start gap-3 rounded-2xl p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] ${
                method === m.id
                  ? "bg-white/35 ring-1 ring-white/30"
                  : "bg-white/15 hover:bg-white/25"
              }`}
            >
              {m.id === "card" ? (
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <Wallet className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              <span>
                <span className="block text-sm font-bold text-black">{m.label}</span>
                <span className="block text-xs text-black/60">{m.description}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-black/60">
          Quick pay
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_PAY.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setMethod(q.id)}
              aria-pressed={method === q.id}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#675c56] ${
                method === q.id
                  ? "bg-white/40 text-black ring-1 ring-white/30"
                  : "bg-white/15 text-black/80 hover:bg-white/25"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-[#b91c1c]" role="alert">
          {error}
        </p>
      )}

      <FlowButton
        text={submitting ? "Processing…" : "Top up"}
        onClick={handleTopUp}
        disabled={submitting}
      />
    </div>
  );
}
