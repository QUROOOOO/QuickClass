"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard, Field, inputClass } from "@/components/auth/AuthCard";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { setAuthFieldState } from "@/components/background/ComputationalField";

export default function LoginPage() {
  const router = useRouter();
  const { adapter } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      setAuthFieldState("error");
      return;
    }
    setBusy(true);
    setAuthFieldState("submit");
    try {
      await adapter.signIn(email.trim(), password, remember);
      setAuthFieldState("success");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't sign you in. Check your details and try again.");
      setAuthFieldState("error");
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      setError("Enter your email first, then request a reset.");
      return;
    }
    setError(null);
    setInfo("If that account exists, a reset link is on its way.");
    await adapter.resetPassword(email.trim());
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue where you left off."
      footer={
        <>
          New to Code Butler?{" "}
          <Link href="/signup" className="text-accent-strong font-medium hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        {!adapter.configured && (
          <p className="mb-5 px-3 py-2 rounded-control bg-surface-secondary text-text-secondary text-[12px]">
            Demo mode — the identity backend isn&apos;t connected yet. Any details work,
            and nothing leaves this device.
          </p>
        )}

        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setAuthFieldState("focus")}
            onBlur={() => setAuthFieldState("idle")}
            onKeyDown={() => setAuthFieldState("typing")}
            placeholder="you@example.com"
            autoComplete="email"
            className={inputClass}
            required
          />
        </Field>

        <Field label="Password">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              className={`${inputClass} pr-20`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[11.5px] text-text-secondary hover:text-text-primary"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between mb-6 -mt-1">
          <label className="flex items-center gap-2 text-[12.5px] text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded-[5px] accent-[var(--accent)]"
            />
            Remember me
          </label>
          <button type="button" onClick={forgot} className="text-[12.5px] text-accent-strong hover:underline">
            Forgot password?
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 px-3 py-2 rounded-control bg-error-soft text-error text-[12.5px]">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="mb-4 px-3 py-2 rounded-control bg-success-soft text-success text-[12.5px]">
            {info}
          </p>
        )}

        <Button size="lg" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
