"use client";

import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2, User, Building2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

const features = [
  "Multi-Tenant Architecture",
  "Role-Based Access Control",
  "AI-Powered Insights",
  "Immutable Audit Trail",
  "Policy Vault",
];

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    organisation_name: "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [loading, isAuthenticated, router]);

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const newErrors: Record<string, string> = {};
    if (!formData.organisation_name.trim()) {
      newErrors.organisation_name = "Organisation name is required.";
    }
    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required.";
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required.";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required.";
    }
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    try {
      const result = await api.post<{
        access: string;
        refresh: string;
        user: { email: string };
        message: string;
      }>("/api/v1/accounts/signup/", formData);

      // Store tokens and redirect to onboarding
      localStorage.setItem("access_token", result.access);
      localStorage.setItem("refresh_token", result.refresh);
      // Force a full page reload to pick up the new auth state
      window.location.href = "/onboarding";
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const response = (err as { response: Record<string, string> }).response;
        setErrors(response);
      } else {
        setErrors({ general: err instanceof Error ? err.message : "Registration failed. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

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
            Register Your<br />Organisation
          </h2>
          <p className="mt-3 text-sm uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
            Built for Institutional Memory
          </p>
          <p className="mt-5 text-lg leading-relaxed max-w-md" style={{ color: "var(--text-secondary)" }}>
            Set up your organisation on Appraiser and get access to enterprise-grade
            performance management, AI tools, and institutional memory — all in one platform.
          </p>
          <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            You will be the administrator of your organisation. Team members are added
            by admins after setup — no self-registration.
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
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {["SM", "JD", "AK"].map((initials, i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold"
                  style={{ borderColor: "var(--bg-secondary)", backgroundColor: ["#f85149", "#58a6ff", "#4ade80"][i] + "30", color: ["#f85149", "#58a6ff", "#4ade80"][i] }}
                >
                  {initials}
                </div>
              ))}
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Trusted by <span className="font-semibold" style={{ color: "var(--text-primary)" }}>500+</span> organisations worldwide
            </p>
          </div>
        </div>
      </div>

      {/* Right signup form */}
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

          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Register your organisation</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Create your organisation account — you&apos;ll be the first administrator
          </p>

          {errors.general && (
            <div className="mt-4 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "rgba(248, 81, 73, 0.3)", backgroundColor: "rgba(248, 81, 73, 0.1)", color: "var(--danger)" }}>
              {errors.general}
            </div>
          )}

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            {/* Organisation Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Organisation Name</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  value={formData.organisation_name}
                  onChange={(e) => updateField("organisation_name", e.target.value)}
                  placeholder="Your organisation name"
                  required
                  className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                />
              </div>
              {errors.organisation_name && (
                <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{errors.organisation_name}</p>
              )}
            </div>

            {/* Divider */}
            <div className="relative pt-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: "var(--border)" }} />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}>Admin Account</span>
              </div>
            </div>

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>First Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => updateField("first_name", e.target.value)}
                    placeholder="First name"
                    required
                    className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-colors"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                  />
                </div>
                {errors.first_name && (
                  <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{errors.first_name}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Last Name</label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
                  placeholder="Last name"
                  required
                  className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                />
                {errors.last_name && (
                  <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{errors.last_name}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="admin@yourcompany.com"
                  required
                  className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
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
              {errors.password && (
                <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-6"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)", boxShadow: "var(--shadow)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--accent-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--accent)"; }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Setting up organisation..." : "Register Organisation"}
            </button>

            <p className="text-center text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              By registering, you agree to our Terms of Service and Privacy Policy.
            </p>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: "var(--border)" }} />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)" }}>or</span>
              </div>
            </div>

            <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
              Already have an account?{" "}
              <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
