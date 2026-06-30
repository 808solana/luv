"use client";

import { useState } from "react";

export function NotifyForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    try {
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
      setMessage("You're on the list. We'll let you know when API keys are live.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col flex-wrap gap-4 sm:flex-row">
      <label htmlFor="email" className="sr-only">
        Email address
      </label>
      <input
        id="email"
        type="email"
        name="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        required
        className="h-12 flex-1 rounded-sm border-0 bg-white/10 px-4 text-base text-black shadow-sm ring-1 ring-white/20 placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black/60"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="h-12 rounded-sm px-6 text-base font-bold text-black transition-colors disabled:opacity-60 ring-1 ring-white/25 [backdrop-filter:blur(12px)] [-webkit-backdrop-filter:blur(12px)]"
      >
        {status === "loading" ? "Sending..." : "Get notified"}
      </button>
      {message && (
        <p className="w-full" aria-live="polite">
          <span
            className={`text-sm ${
              status === "success" ? "text-black/70" : "text-red-400"
            }`}
          >
            {message}
          </span>
        </p>
      )}
    </form>
  );
}
