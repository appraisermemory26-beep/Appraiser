"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Upload,
  CheckCircle2,
  FileText,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Organisation } from "@/lib/types";

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { number: 1, label: "Organisation Profile" },
    { number: 2, label: "Upload Organogram" },
    { number: 3, label: "Setup Complete" },
  ];

  return (
    <div className="flex items-center justify-center gap-3 mb-10">
      {steps.map((step, i) => (
        <div key={step.number} className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300"
              style={{
                backgroundColor:
                  currentStep > step.number
                    ? "var(--accent)"
                    : currentStep === step.number
                    ? "var(--accent)"
                    : "var(--bg-secondary)",
                color:
                  currentStep >= step.number
                    ? "var(--accent-on)"
                    : "var(--text-muted)",
                boxShadow:
                  currentStep === step.number
                    ? "0 0 0 4px rgba(74, 222, 128, 0.15)"
                    : "none",
              }}
            >
              {currentStep > step.number ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                step.number
              )}
            </div>
            <span
              className="text-sm font-medium hidden sm:inline"
              style={{
                color:
                  currentStep >= step.number
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
              }}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="h-px w-8 sm:w-16 transition-all duration-300"
              style={{
                backgroundColor:
                  currentStep > step.number
                    ? "var(--accent)"
                    : "var(--border)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Organisation Profile ────────────────────────────────────────────

function StepOrganisationProfile({
  organisation,
  onNext,
}: {
  organisation: Organisation;
  onNext: () => void;
}) {
  const [formData, setFormData] = useState({
    name: organisation.name || "",
    address: organisation.address || "",
    phone: organisation.phone || "",
    email: organisation.email || "",
    website: organisation.website || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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

    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Organisation name is required.";
    if (!formData.email.trim()) newErrors.email = "Email is required.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await api.patch(
        `/api/v1/organisations/organisations/${organisation.id}/`,
        formData
      );
      onNext();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "body" in err) {
        const body = (err as { body: Record<string, string[]> }).body;
        const fieldErrors: Record<string, string> = {};
        for (const [key, val] of Object.entries(body)) {
          fieldErrors[key] = Array.isArray(val) ? val[0] : String(val);
        }
        setErrors(fieldErrors);
      } else {
        setErrors({
          general:
            err instanceof Error ? err.message : "Failed to save. Please try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    borderColor: "var(--border)",
    backgroundColor: "var(--bg-input)",
    color: "var(--text-primary)",
  };

  return (
    <div>
      <h2
        className="text-2xl font-bold tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        Organisation Profile
      </h2>
      <p
        className="mt-2 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        Let us know more about your organisation to get started.
      </p>

      {errors.general && (
        <div
          className="mt-4 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "rgba(248, 81, 73, 0.3)",
            backgroundColor: "rgba(248, 81, 73, 0.1)",
            color: "var(--danger)",
          }}
        >
          {errors.general}
        </div>
      )}

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        {/* Organisation Name */}
        <div>
          <label
            className="mb-1.5 block text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Organisation Name <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <div className="relative">
            <Building2
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Your organisation name"
              required
              className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            />
          </div>
          {errors.name && (
            <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
              {errors.name}
            </p>
          )}
        </div>

        {/* Address */}
        <div>
          <label
            className="mb-1.5 block text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Address
          </label>
          <div className="relative">
            <MapPin
              className="absolute left-3.5 top-3 h-4 w-4"
              style={{ color: "var(--text-muted)" }}
            />
            <textarea
              value={formData.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="123 Business Street, City, Country"
              rows={3}
              className="w-full rounded-lg border pl-10 pr-4 py-2.5 text-sm outline-none transition-colors resize-none"
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            />
          </div>
          {errors.address && (
            <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
              {errors.address}
            </p>
          )}
        </div>

        {/* Phone and Email row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Phone
            </label>
            <div className="relative">
              <Phone
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-colors"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              />
            </div>
            {errors.phone && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {errors.phone}
              </p>
            )}
          </div>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Email <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="org@company.com"
                required
                className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-colors"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                {errors.email}
              </p>
            )}
          </div>
        </div>

        {/* Website */}
        <div>
          <label
            className="mb-1.5 block text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Website{" "}
            <span className="font-normal" style={{ color: "var(--text-muted)" }}>
              (optional)
            </span>
          </label>
          <div className="relative">
            <Globe
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="url"
              value={formData.website}
              onChange={(e) => updateField("website", e.target.value)}
              placeholder="https://www.company.com"
              className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            />
          </div>
          {errors.website && (
            <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
              {errors.website}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="h-11 w-full rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 mt-2"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-on)",
            boxShadow: "var(--shadow)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent)";
          }}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving..." : "Next"}
          {!saving && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

// ─── Step 2: Upload Organogram ───────────────────────────────────────────────

function StepUploadOrganogram({
  organisation,
  onNext,
  onBack,
}: {
  organisation: Organisation;
  onNext: () => void;
  onBack: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<"idle" | "parsed" | "failed">("idle");
  const [error, setError] = useState("");

  const acceptedTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
  ];

  function handleFile(f: File) {
    if (!acceptedTypes.includes(f.type)) {
      setError("Please upload a PDF or image file (PNG, JPG, JPEG).");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError("File size must be less than 20MB.");
      return;
    }
    setError("");
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function handleUpload() {
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      // Upload to Cloudinary first
      const { uploadToCloudinary } = await import("@/lib/cloudinary");
      const result = await uploadToCloudinary(file, "appraiser/organograms");

      // Save the Cloudinary URL to the organisation
      await api.patch(
        `/api/v1/organisations/organisations/${organisation.id}/`,
        { organogram_file: result.secure_url }
      );
      setParsing(true);
      try {
        await api.post(
          `/api/v1/organisations/organisations/${organisation.id}/parse-organogram/`
        );
        setParseStatus("parsed");
      } catch {
        setParseStatus("failed");
      } finally {
        setParsing(false);
      }
      onNext();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h2
        className="text-2xl font-bold tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        Upload your Organisation Chart
      </h2>
      <p
        className="mt-2 text-sm leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        Upload your official organisational chart (PDF or image). This is
        required to complete your setup.
      </p>

      {error && (
        <div
          className="mt-4 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "rgba(248, 81, 73, 0.3)",
            backgroundColor: "rgba(248, 81, 73, 0.1)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}
      {parseStatus === "parsed" && (
        <div
          className="mt-4 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "rgba(74, 222, 128, 0.3)",
            backgroundColor: "rgba(74, 222, 128, 0.1)",
            color: "var(--accent)",
          }}
        >
          Organogram parsed successfully. Suggested structure is now available for admin setup.
        </div>
      )}
      {parseStatus === "failed" && (
        <div
          className="mt-4 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: "rgba(251, 191, 36, 0.35)",
            backgroundColor: "rgba(251, 191, 36, 0.08)",
            color: "#fbbf24",
          }}
        >
          Organogram uploaded, but automatic parsing could not complete. You can still continue and configure structure manually.
        </div>
      )}

      {/* Drop zone */}
      <div
        className="mt-8 rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-200"
        style={{
          borderColor: dragOver ? "var(--accent)" : "var(--border)",
          backgroundColor: dragOver
            ? "rgba(74, 222, 128, 0.05)"
            : "var(--bg-secondary)",
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById("organogram-input")?.click()}
      >
        <input
          id="organogram-input"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: "rgba(74, 222, 128, 0.1)",
              }}
            >
              <FileText className="h-7 w-7" style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {file.name}
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-primary)",
              }}
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                backgroundColor: "var(--bg-secondary)",
              }}
            >
              <Upload className="h-7 w-7" style={{ color: "var(--text-muted)" }} />
            </div>
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Drop your file here, or{" "}
                <span style={{ color: "var(--accent)" }}>browse</span>
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                PDF, PNG, JPG or JPEG (max 20MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-8">
        <button
          type="button"
          onClick={onBack}
          className="h-11 flex-1 rounded-lg border text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
            backgroundColor: "var(--bg-primary)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--bg-primary)";
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || parsing || !file}
          className="h-11 flex-[2] rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-on)",
            boxShadow: "var(--shadow)",
          }}
          onMouseEnter={(e) => {
            if (!uploading && file) {
              e.currentTarget.style.backgroundColor = "var(--accent-hover)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent)";
          }}
        >
          {(uploading || parsing) && <Loader2 className="h-4 w-4 animate-spin" />}
          {uploading ? "Uploading..." : parsing ? "Parsing Organogram..." : "Upload & Continue"}
          {!uploading && !parsing && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Setup Complete ──────────────────────────────────────────────────

function StepComplete({
  organisation,
  onFinish,
}: {
  organisation: Organisation;
  onFinish: () => void;
}) {
  const [completing, setCompleting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const completeSetup = useCallback(async () => {
    setCompleting(true);
    setError("");
    try {
      await api.patch(
        `/api/v1/organisations/organisations/${organisation.id}/`,
        { is_setup_complete: true }
      );
      setDone(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to complete setup. Please try again."
      );
    } finally {
      setCompleting(false);
    }
  }, [organisation.id]);

  useEffect(() => {
    completeSetup();
  }, [completeSetup]);

  if (completing) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2
          className="h-10 w-10 animate-spin"
          style={{ color: "var(--accent)" }}
        />
        <p
          className="mt-4 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Completing your setup...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div
          className="rounded-lg border px-6 py-4 text-sm text-center"
          style={{
            borderColor: "rgba(248, 81, 73, 0.3)",
            backgroundColor: "rgba(248, 81, 73, 0.1)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
        <button
          type="button"
          onClick={completeSetup}
          className="mt-6 h-11 rounded-lg px-8 text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-on)",
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full mb-6"
          style={{ backgroundColor: "rgba(74, 222, 128, 0.1)" }}
        >
          <CheckCircle2
            className="h-10 w-10"
            style={{ color: "var(--accent)" }}
          />
        </div>

        <h2
          className="text-2xl font-bold tracking-tight text-center"
          style={{ color: "var(--text-primary)" }}
        >
          Your organisation is set up!
        </h2>
        <p
          className="mt-3 text-sm text-center max-w-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Everything is ready. You can now start managing your organisation,
          assigning tasks, and tracking performance.
        </p>

        <button
          type="button"
          onClick={onFinish}
          className="mt-8 h-11 rounded-lg px-10 text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-on)",
            boxShadow: "var(--shadow)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent)";
          }}
        >
          Go to Dashboard
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return null;
}

// ─── Main Onboarding Page ────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, organisation, loading, isAuthenticated, isSetupComplete, refreshOrganisation } =
    useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [orgData, setOrgData] = useState<Organisation | null>(null);

  // Force light mode on onboarding
  useEffect(() => {
    const prev = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "light");
    return () => {
      if (prev) document.documentElement.setAttribute("data-theme", prev);
    };
  }, []);

  // Auth guard
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  // If already set up, redirect to dashboard
  useEffect(() => {
    if (!loading && isAuthenticated && isSetupComplete) {
      router.replace("/dashboard");
    }
  }, [loading, isAuthenticated, isSetupComplete, router]);

  // Fetch fresh org data for the form
  useEffect(() => {
    if (isAuthenticated && organisation) {
      setOrgData(organisation);
    }
  }, [isAuthenticated, organisation]);

  // Re-fetch org data when moving between steps to get latest state
  const refreshOrgData = useCallback(async () => {
    try {
      const org = await api.get<Organisation>("/api/v1/organisations/my-org/");
      setOrgData(org);
    } catch {
      // keep existing data
    }
  }, []);

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <Loader2
          className="h-8 w-8 animate-spin"
          style={{ color: "var(--accent)" }}
        />
      </div>
    );
  }

  if (!isAuthenticated || !orgData) return null;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <Image src="/logo.png" alt="Appraiser" width={56} height={56} priority className="object-contain" />
        <div>
          <p className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Appraiser
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
            Built for Institutional Memory
          </p>
        </div>
      </div>

      {/* Welcome message */}
      <p
        className="text-sm mb-6 text-center"
        style={{ color: "var(--text-secondary)" }}
      >
        Welcome, {user?.first_name}! Let&apos;s finish setting up your organisation.
      </p>

      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* Card */}
      <div
        className="w-full max-w-lg rounded-xl border p-6 sm:p-8"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-card)",
          boxShadow: "0 4px 24px var(--shadow)",
        }}
      >
        {step === 1 && (
          <StepOrganisationProfile
            organisation={orgData}
            onNext={async () => {
              await refreshOrgData();
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <StepUploadOrganogram
            organisation={orgData}
            onNext={async () => {
              await refreshOrgData();
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <StepComplete
            organisation={orgData}
            onFinish={async () => {
              await refreshOrganisation();
              window.location.href = "/dashboard";
            }}
          />
        )}
      </div>

      {/* Footer */}
      <p
        className="mt-8 text-xs text-center"
        style={{ color: "var(--text-muted)" }}
      >
        Step {step} of 3
      </p>
    </div>
  );
}
