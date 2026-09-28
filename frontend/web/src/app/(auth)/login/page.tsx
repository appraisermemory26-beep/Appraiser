"use client";

import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const features = [
  "Task Management",
  "AI Tools",
  "Policy Vault",
  "Audit Trail",
  "Performance Tracking",
];

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [loading, isAuthenticated, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  // Show nothing while checking auth (prevents flash)
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--bg-primary)" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12" style={{ background: "linear-gradient(to bottom, var(--bg-primary), var(--bg-secondary))" }}>
        <div>
          <div className="flex items-center gap-3 mb-16">
            <Image src="/logo.png" alt="Appraiser" width={56} height={56} priority className="object-contain" />
            <div>
              <p className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Appraiser</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
                Focus · Productivity · Performance
              </p>
            </div>
          </div>

          <h2 className="text-4xl font-bold tracking-tight leading-[1.1]" style={{ color: "var(--text-primary)" }}>
            Enterprise Performance<br />& Productivity Platform
          </h2>
          <p className="mt-3 text-sm uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
            Built for Institutional Memory
          </p>
          <p className="mt-5 text-lg leading-relaxed max-w-md" style={{ color: "var(--text-secondary)" }}>
            Streamline your team performance, manage tasks, and leverage AI-powered
            insights to drive organizational excellence.
          </p>

          <div className="mt-10 flex flex-wrap gap-2.5">
            {features.map((f) => (
              <span
                key={f}
                className="rounded-full border px-4 py-1.5 text-sm font-medium"
                style={{ borderColor: "var(--accent-muted)", backgroundColor: "var(--accent-muted)", color: "var(--accent)" }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="border-t pt-6" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm italic leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            &ldquo;Appraiser has transformed how we manage team performance. The AI assistant
            alone has saved us countless hours on writing job descriptions and policy documents.&rdquo;
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(188, 140, 255, 0.2)", color: "var(--purple)" }}>
              SM
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Sarah Mitchell</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>VP of Operations, TechCorp Inc.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8" style={{ backgroundColor: "var(--bg-primary)" }}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <Image src="/logo.png" alt="Appraiser" width={48} height={48} priority className="object-contain" />
            <div>
              <p className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Appraiser</p>
              <p className="mt-0.5 text-[9px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>
                Built for Institutional Memory
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Welcome back</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Sign in to your Appraiser account
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

            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="h-11 w-full rounded-lg border pl-10 pr-11 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
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

            <div className="flex items-center justify-end">
              <Link href="/forgot-password" className="text-sm font-medium hover:underline" style={{ color: "var(--accent)" }}>
                Forgot password?
              </Link>
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
              {submitting ? "Signing in..." : "Sign in"}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: "var(--border)" }} />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}>or</span>
              </div>
            </div>

            <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
              Need to register an organisation?{" "}
              <Link href="/signup" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                Register here
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
