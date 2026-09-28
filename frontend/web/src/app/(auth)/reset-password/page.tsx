"use client";

import { Suspense, useState } from "react";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") || "";
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const isValid = uid && token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/v1/accounts/password-reset/confirm/", {
        uid,
        token,
        new_password: password,
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to reset password. The link may have expired.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isValid) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(248,81,73,0.15)" }}>
            <AlertCircle className="h-7 w-7" style={{ color: "var(--danger)" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Invalid Reset Link</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium hover:underline" style={{ color: "var(--accent)" }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "var(--accent-muted)" }}>
            <CheckCircle2 className="h-7 w-7" style={{ color: "var(--accent)" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Password Set Successfully</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Your password has been set. You can now sign in with your new credentials.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-lg text-sm font-semibold transition-all"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
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

        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Set Your Password</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Create a secure password for your Appraiser account.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "rgba(248,81,73,0.3)", backgroundColor: "rgba(248,81,73,0.1)", color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                className="h-11 w-full rounded-lg border pl-10 pr-11 text-sm outline-none transition-colors"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                minLength={8}
                className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-colors"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Setting password..." : "Set Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{ backgroundColor: "var(--bg-primary)" }}
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
