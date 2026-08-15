"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  WalletCards,
  X,
} from "lucide-react";
import { CopyField } from "@/components/ui/copy-field";
import { API_BASE, apiRequest, isUnauthorized } from "@/lib/api";

const MODEL_SLUG = "luv13-glm-5.2";
const QUICK_AMOUNTS = [5, 10, 15, 30];

type ApiKey = {
  id: number;
  name: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

type Session = {
  user: { email: string; name: string | null };
  keys: ApiKey[];
};

type Usage = {
  id: number;
  ts: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  charge_umicro: number | null;
  cost_usd: number;
  status: number | string;
};

type CreatedKey = {
  id: number;
  key: string;
  key_prefix: string;
  name: string;
  created_at: string;
};

function dollarsFromUmicro(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value / 1_000_000);
}

function requestCost(row: Usage): string {
  return row.charge_umicro == null
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 6,
      }).format(row.cost_usd)
    : dollarsFromUmicro(row.charge_umicro);
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: Usage["status"]): string {
  const numeric = typeof status === "number" ? status : Number(status);
  if (Number.isFinite(numeric)) {
    if (numeric >= 200 && numeric < 300) return "Success";
    return `Failed (${numeric})`;
  }
  return String(status).replaceAll("_", " ");
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[32px] bg-white p-6 text-black shadow-2xl sm:rounded-[32px] sm:p-8"
      >
        <header className="mb-7 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-2xl font-bold tracking-tight">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-black/60 transition-colors duration-150 hover:bg-black/[0.06] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Close ${title}`}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [keyName, setKeyName] = useState("Cursor");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const load = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      setLoadError("");
      try {
        const [me, wallet, recent] = await Promise.all([
          apiRequest<Session>("/auth/me"),
          apiRequest<{ balance_umicro: number }>("/billing/balance"),
          apiRequest<{ usage: Usage[] }>("/api/usage?limit=50"),
        ]);
        setSession(me);
        setBalance(wallet.balance_umicro);
        setUsage(recent.usage);
      } catch (error) {
        if (isUnauthorized(error)) {
          router.replace("/login");
          return;
        }
        setLoadError(
          error instanceof Error
            ? error.message
            : "Dashboard data did not load.",
        );
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    let openTimer: number | undefined;
    if (new URLSearchParams(window.location.search).get("topup") === "1") {
      openTimer = window.setTimeout(() => setTopUpOpen(true), 0);
    }
    const loadTimer = window.setTimeout(() => void load(true), 0);
    const timer = window.setInterval(() => void load(false), 15_000);
    return () => {
      if (openTimer !== undefined) window.clearTimeout(openTimer);
      window.clearTimeout(loadTimer);
      window.clearInterval(timer);
    };
  }, [load]);

  async function logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKeyBusy(true);
    setKeyError("");
    try {
      const key = await apiRequest<CreatedKey>("/api/keys", {
        method: "POST",
        body: JSON.stringify({ name: keyName }),
      });
      setCreatedKey(key);
      setSession((current) =>
        current
          ? {
              ...current,
              keys: [
                {
                  id: key.id,
                  name: key.name,
                  key_prefix: key.key_prefix,
                  created_at: key.created_at,
                  revoked_at: null,
                  last_used_at: null,
                },
                ...current.keys,
              ],
            }
          : current,
      );
      setKeyName("Cursor");
    } catch (error) {
      setKeyError(
        error instanceof Error ? error.message : "The key was not created.",
      );
    } finally {
      setKeyBusy(false);
    }
  }

  async function revokeKey(keyId: number) {
    setRevokingId(keyId);
    setKeyError("");
    try {
      await apiRequest(`/api/keys/${keyId}/revoke`, { method: "POST" });
      setSession((current) =>
        current
          ? { ...current, keys: current.keys.filter((key) => key.id !== keyId) }
          : current,
      );
    } catch (error) {
      setKeyError(
        error instanceof Error ? error.message : "The key was not revoked.",
      );
    } finally {
      setRevokingId(null);
    }
  }

  if (loading) {
    return (
      <main className="relative z-10 flex min-h-dvh items-center justify-center bg-white text-black">
        <div
          className="flex items-center gap-3 text-sm font-semibold"
          role="status"
        >
          <LoaderCircle className="animate-spin" size={18} />
          Loading your dashboard
        </div>
      </main>
    );
  }

  if (loadError || !session || balance === null) {
    return (
      <main className="relative z-10 flex min-h-dvh items-center justify-center bg-white px-6 text-black">
        <section className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Dashboard unavailable</h1>
          <p className="mt-3 text-black/60">
            {loadError || "Your account data did not load."}
          </p>
          <button
            type="button"
            onClick={() => void load(true)}
            className="mt-6 min-h-11 rounded-full bg-black px-6 text-sm font-bold text-white transition-[transform,opacity] duration-150 hover:opacity-80 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  const activeKeys = session.keys.filter((key) => !key.revoked_at);
  const curl = `curl ${API_BASE}/v1/chat/completions \\\n  -H "Authorization: Bearer ${createdKey?.key ?? "YOUR_LUV13_KEY"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"${MODEL_SLUG}","messages":[{"role":"user","content":"Say hello in one sentence."}]}'`;

  return (
    <main className="relative z-10 min-h-dvh bg-white text-black">
      <header className="border-b border-black/[0.07] px-4 sm:px-6">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4">
          <Link
            href="/"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Image
              src="/BRAND_ASSETS/LUV13.png"
              alt="LUV13"
              width={112}
              height={38}
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-56 truncate text-sm text-black/55 sm:block">
              {session.user.email}
            </span>
            <button
              type="button"
              onClick={() => void load(false)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-black/60 transition-colors duration-150 hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Refresh dashboard"
            >
              <RefreshCw size={17} />
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-black/65 transition-colors duration-150 hover:bg-black/[0.05] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <article className="rounded-[28px] bg-black p-7 text-white sm:p-9">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
              <WalletCards size={17} />
              Real balance
            </div>
            <p className="mt-8 font-mono text-5xl font-bold tracking-[-0.06em] tabular-nums sm:text-7xl">
              {dollarsFromUmicro(balance)}
            </p>
            <p className="mt-4 max-w-lg text-sm leading-6 text-white/55">
              Credit updates after Stripe confirms your payment. Usage is
              charged at $0.33 per million total tokens.
            </p>
          </article>
          <article className="flex flex-col justify-between rounded-[28px] bg-black/[0.035] p-7 ring-1 ring-black/[0.06] sm:p-9">
            <div>
              <p className="text-sm font-bold text-black/55">Add credit</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">
                Top up when you need it.
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setTopUpOpen(true)}
              className="mt-8 flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-bold text-white transition-[transform,opacity] duration-150 hover:opacity-85 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Plus size={17} />
              Top up
            </button>
          </article>
        </section>

        <section aria-labelledby="usage-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/45">
                Your account
              </p>
              <h2
                id="usage-heading"
                className="mt-2 text-2xl font-bold tracking-tight"
              >
                Recent usage
              </h2>
            </div>
            <p className="text-sm text-black/45">{usage.length} recent</p>
          </div>
          {usage.length === 0 ? (
            <div className="rounded-[24px] bg-black/[0.025] px-6 py-10 text-center ring-1 ring-black/[0.06]">
              <p className="font-bold">No requests yet.</p>
              <p className="mt-2 text-sm text-black/55">
                Create a key below, then your token usage will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] ring-1 ring-black/[0.07]">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/[0.035] text-xs uppercase tracking-[0.12em] text-black/45">
                    <tr>
                      <th className="px-5 py-4 font-bold">Timestamp</th>
                      <th className="px-5 py-4 font-bold">Customer model</th>
                      <th className="px-5 py-4 text-right font-bold">Input</th>
                      <th className="px-5 py-4 text-right font-bold">Output</th>
                      <th className="px-5 py-4 text-right font-bold">Cost</th>
                      <th className="px-5 py-4 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((row) => (
                      <tr key={row.id} className="border-t border-black/[0.06]">
                        <td className="whitespace-nowrap px-5 py-4 text-black/55">
                          {dateTime(row.ts)}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs">
                          {row.model}
                        </td>
                        <td className="px-5 py-4 text-right font-mono tabular-nums">
                          {row.tokens_in.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right font-mono tabular-nums">
                          {row.tokens_out.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right font-mono tabular-nums">
                          {requestCost(row)}
                        </td>
                        <td className="px-5 py-4 font-semibold">
                          {statusLabel(row.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-black/[0.06] md:hidden">
                {usage.map((row) => (
                  <article key={row.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs font-bold">
                          {row.model}
                        </p>
                        <p className="mt-1 text-xs text-black/45">
                          {dateTime(row.ts)}
                        </p>
                      </div>
                      <span className="text-xs font-bold">
                        {statusLabel(row.status)}
                      </span>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <dt className="text-black/45">Input</dt>
                        <dd className="mt-1 font-mono tabular-nums">
                          {row.tokens_in.toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-black/45">Output</dt>
                        <dd className="mt-1 font-mono tabular-nums">
                          {row.tokens_out.toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-black/45">Cost</dt>
                        <dd className="mt-1 font-mono tabular-nums">
                          {requestCost(row)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        <section
          aria-labelledby="keys-heading"
          className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <article className="rounded-[28px] bg-black/[0.025] p-6 ring-1 ring-black/[0.06] sm:p-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-black/55">
              <KeyRound size={17} />
              API access
            </div>
            <h2
              id="keys-heading"
              className="mt-4 text-2xl font-bold tracking-tight"
            >
              Create an API key
            </h2>
            <p className="mt-3 text-sm leading-6 text-black/55">
              Key creation works with a $0 balance. Add credit before the first
              model request.
            </p>
            <form onSubmit={createKey} className="mt-7">
              <label htmlFor="key-name" className="text-sm font-bold">
                Key name
              </label>
              <input
                id="key-name"
                required
                maxLength={80}
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl bg-black/[0.05] px-4 text-base outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={keyBusy}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-bold text-white transition-[transform,opacity] duration-150 hover:opacity-85 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {keyBusy && <LoaderCircle className="animate-spin" size={17} />}
                {keyBusy ? "Creating key" : "Create key"}
              </button>
            </form>
            {keyError && (
              <p
                role="alert"
                className="mt-4 text-sm font-medium text-destructive"
              >
                {keyError}
              </p>
            )}
          </article>

          <article className="rounded-[28px] p-6 ring-1 ring-black/[0.07] sm:p-8">
            <h3 className="text-lg font-bold">Your keys</h3>
            {activeKeys.length === 0 ? (
              <div className="py-10 text-center">
                <p className="font-bold">No active keys.</p>
                <p className="mt-2 text-sm text-black/55">
                  Create one now, then top up to activate your key.
                </p>
              </div>
            ) : (
              <ul className="mt-5 divide-y divide-black/[0.06]">
                {activeKeys.map((key) => (
                  <li
                    key={key.id}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold">{key.name}</p>
                      <p className="mt-1 truncate font-mono text-xs text-black/45">
                        {key.key_prefix}
                      </p>
                      <p className="mt-1 text-xs text-black/45">
                        {key.last_used_at
                          ? `Used ${dateTime(key.last_used_at)}`
                          : "Not used yet"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={revokingId === key.id}
                      onClick={() => void revokeKey(key.id)}
                      className="min-h-11 rounded-full px-4 text-sm font-bold text-destructive transition-colors duration-150 hover:bg-destructive/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-45"
                    >
                      {revokingId === key.id ? "Revoking" : "Revoke"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="rounded-[28px] bg-black p-7 text-white sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
            Quickstart
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">
            Connect to Cursor in 2 minutes
          </h2>
          <ol className="mt-6 grid gap-4 text-sm leading-6 text-white/65 sm:grid-cols-3">
            <li>
              <span className="font-bold text-white">1.</span> Create a key and
              copy it once.
            </li>
            <li>
              <span className="font-bold text-white">2.</span> Set the base URL
              to{" "}
              <span className="font-mono text-xs text-white">{API_BASE}</span>.
            </li>
            <li>
              <span className="font-bold text-white">3.</span> Use model{" "}
              <span className="font-mono text-xs text-white">{MODEL_SLUG}</span>
              .
            </li>
          </ol>
          <details className="mt-7 rounded-2xl bg-white/[0.07] p-5">
            <summary className="cursor-pointer font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Advanced connection details
            </summary>
            <div className="mt-5 flex flex-col gap-3">
              <CopyField label="API base URL" value={API_BASE} />
              <CopyField label="Model slug" value={MODEL_SLUG} />
            </div>
          </details>
        </section>
      </div>

      {topUpOpen && <TopUpModal onClose={() => setTopUpOpen(false)} />}
      {createdKey && (
        <Modal title="Copy your key now" onClose={() => setCreatedKey(null)}>
          <p className="mb-5 text-sm leading-6 text-black/60">
            This full secret is shown once. Store it in your password manager;
            LUV13 cannot show it again.
          </p>
          <div className="flex flex-col gap-3">
            <CopyField label="API key" value={createdKey.key} />
            <CopyField label="API base URL" value={API_BASE} />
            <CopyField label="Model slug" value={MODEL_SLUG} />
            <CopyField label="Tested curl" value={curl} />
          </div>
          <button
            type="button"
            onClick={() => setCreatedKey(null)}
            className="mt-6 min-h-12 w-full rounded-full bg-black px-5 text-sm font-bold text-white transition-[transform,opacity] duration-150 hover:opacity-85 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            I saved my key
          </button>
        </Modal>
      )}
    </main>
  );
}

function TopUpModal({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ url: string }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ amount_usd: amount }),
      });
      window.location.assign(result.url);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Checkout did not start.",
      );
      setBusy(false);
    }
  }

  return (
    <Modal title="Top up" onClose={onClose}>
      <form onSubmit={checkout}>
        <label
          htmlFor="top-up-amount"
          className="block text-center text-sm font-bold"
        >
          Custom dollars
        </label>
        <div className="mx-auto mt-3 flex max-w-xs items-center rounded-2xl bg-black/[0.045] px-5 ring-1 ring-black/10 focus-within:ring-2 focus-within:ring-primary">
          <span className="text-2xl font-bold text-black/45">$</span>
          <input
            id="top-up-amount"
            type="number"
            inputMode="decimal"
            min="5"
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="min-h-16 w-full bg-transparent px-3 text-center font-mono text-3xl font-bold tabular-nums outline-none"
          />
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2" aria-label="Quick amounts">
          {QUICK_AMOUNTS.map((quickAmount) => (
            <button
              key={quickAmount}
              type="button"
              onClick={() => setAmount(String(quickAmount))}
              aria-pressed={amount === String(quickAmount)}
              className="min-h-11 rounded-full bg-black/[0.045] text-sm font-bold ring-1 ring-black/[0.07] transition-[transform,background-color] duration-150 hover:bg-black/[0.09] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-pressed:bg-black aria-pressed:text-white"
            >
              ${quickAmount}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-5 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-bold text-white transition-[transform,opacity] duration-150 hover:opacity-85 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy && <LoaderCircle className="animate-spin" size={17} />}
          {busy ? "Opening Stripe" : `Continue with $${amount || "0"}`}
        </button>
      </form>
    </Modal>
  );
}
