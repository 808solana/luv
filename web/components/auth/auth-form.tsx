"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { apiRequest, isUnauthorized } from "@/lib/api";

type AuthMode = "signup" | "login";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/auth/me")
      .then(() => {
        if (active) router.replace("/dashboard");
      })
      .catch((requestError: unknown) => {
        if (active && !isUnauthorized(requestError)) {
          setError("We could not check your session. Try again.");
        }
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiRequest(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Account access failed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div>
        <label
          htmlFor={`${mode}-email`}
          className="text-sm font-semibold text-black"
        >
          Email
        </label>
        <input
          id={`${mode}-email`}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-xl bg-black/[0.045] px-4 text-base text-black outline-none ring-1 ring-black/10 transition-shadow duration-200 focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label
          htmlFor={`${mode}-password`}
          className="text-sm font-semibold text-black"
        >
          Password
        </label>
        <div className="relative mt-2">
          <input
            id={`${mode}-password`}
            type={showPassword ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={10}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={isSignup ? "password-help" : undefined}
            className="min-h-12 w-full rounded-xl bg-black/[0.045] px-4 pr-12 text-base text-black outline-none ring-1 ring-black/10 transition-shadow duration-200 focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute inset-y-0 right-0 flex min-h-12 min-w-12 items-center justify-center rounded-xl text-black/55 transition-colors duration-150 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {isSignup && (
          <p
            id="password-help"
            className="mt-2 text-xs leading-5 text-black/55"
          >
            Use at least 10 characters.
          </p>
        )}
      </div>

      <div aria-live="polite" className="min-h-5">
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={checking || submitting}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-bold text-white transition-[transform,opacity] duration-150 hover:opacity-85 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100"
      >
        {(checking || submitting) && (
          <LoaderCircle className="animate-spin" size={17} aria-hidden="true" />
        )}
        {checking
          ? "Checking session"
          : submitting
            ? "Working"
            : isSignup
              ? "Create account"
              : "Log in"}
      </button>

      <p className="text-center text-sm text-black/60">
        {isSignup ? "Already have an account?" : "New to LUV13?"}{" "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-bold text-black underline decoration-black/25 underline-offset-4 transition-colors duration-150 hover:decoration-black focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {isSignup ? "Log in" : "Create account"}
        </Link>
      </p>
    </form>
  );
}
