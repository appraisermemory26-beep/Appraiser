"use client";

import { useState } from "react";
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await api.post("/api/v1/accounts/password-reset/", { email });
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <Image src="/logo.png" alt="Appraiser" width={48} height={48} priority className="object-contain" />
          <div>
            <p className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Appraiser</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>
              Built for Institutional Memory
            </p>
          </div>
        </div>

        {sent ? (
          <div className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "var(--accent-muted)" }}>
              <CheckCircle2 className="h-7 w-7" style={{ color: "var(--accent)" }} />
            </div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Check your email</h1>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              If an account with <span className="font-medium" style={{ color: "var(--text-primary)" }}>{email}</span> exists,
              we&apos;ve sent a password reset link. Please check your inbox and spam folder.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium hover:underline"
              style={{ color: "var(--accent)" }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Forgot your password?</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              Enter your email address and we&apos;ll send you a secure link to reset your password.
            </p>

            {error && (
              <div className="mt-4 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "rgba(248, 81, 73, 0.3)", backgroundColor: "rgba(248, 81, 73, 0.1)", color: "var(--danger)" }}>
                {error}
              </div>
            )}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-colors"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)", boxShadow: "var(--shadow)" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--accent-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--accent)"; }}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Sending..." : "Send reset link"}
              </button>

              <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                Remember your password?{" "}
                <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                  Sign in
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
