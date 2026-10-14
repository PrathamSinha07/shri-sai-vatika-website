"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (res.ok && data?.ok) {
        router.replace("/admin/bookings");
        router.refresh();
        return;
      }
      setError(data?.error ?? "We couldn't sign you in right now. Please try again.");
    } catch {
      setError("We couldn't sign you in right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="admin-email" className="text-small block font-semibold text-foreground">
          Email address
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "admin-login-error" : undefined}
          className="mt-2 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-body text-foreground"
        />
      </div>

      <div>
        <label htmlFor="admin-password" className="text-small block font-semibold text-foreground">
          Password
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "admin-login-error" : undefined}
          className="mt-2 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-body text-foreground"
        />
      </div>

      <div aria-live="polite">
        {error ? (
          <p
            id="admin-login-error"
            role="alert"
            className="rounded-control border border-[#e3bbbb] bg-[#f8e7e7] px-3 py-2 text-small text-[#8a2222]"
          >
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="btn-text w-full bg-primary px-5 py-3 text-surface transition-colors hover:bg-primary-deep disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
