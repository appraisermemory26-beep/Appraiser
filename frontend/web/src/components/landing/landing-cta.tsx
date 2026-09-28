"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const ROLES = [
  "Admin / IT lead",
  "Executive / C-suite",
  "Department head",
  "Manager",
  "Other",
];

export function LandingCta() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    organisation: "",
    role: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Appraiser demo request — ${form.organisation || form.name}`);
    const body = encodeURIComponent(
      `Hi Appraiser team,\n\n` +
      `I'd like to request a demo.\n\n` +
      `Name: ${form.name}\n` +
      `Email: ${form.email}\n` +
      `Organisation: ${form.organisation}\n` +
      `Role: ${form.role}\n\n` +
      `Notes: ${form.message || "—"}\n`
    );
    window.location.href = `mailto:info@credminds.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-24 lg:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <div
          className="relative overflow-hidden rounded-3xl p-10 sm:p-14"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Soft halo */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 -right-40 h-[400px] w-[400px] rounded-full opacity-50 blur-3xl"
            style={{
              background: "radial-gradient(50% 50% at 50% 50%, var(--accent-muted), transparent 70%)",
            }}
          />

          <div className="relative">
            <p
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "var(--accent)" }}
            >
              Request a demo
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--text-primary)" }}>
              Ready to give your institution a memory?
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Tell us a little about your organisation. We&apos;ll respond within one business day with a tailored demo —
              no automated drip, no sales pressure.
            </p>

            {submitted ? (
              <div
                className="mt-10 flex items-start gap-3 rounded-xl p-5"
                style={{ backgroundColor: "var(--accent-muted)", border: "1px solid var(--accent)" }}
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--accent)" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Mail client opened
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    Send the prepared email and we&apos;ll get back to you within one business day.
                    If your client didn&apos;t open, write directly to info@credminds.com.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-10 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Full name"
                    value={form.name}
                    onChange={(v) => setForm({ ...form, name: v })}
                    required
                    placeholder="Jane Doe"
                  />
                  <Field
                    label="Work email"
                    type="email"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    required
                    placeholder="jane@institution.org"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Organisation"
                    value={form.organisation}
                    onChange={(v) => setForm({ ...form, organisation: v })}
                    required
                    placeholder="Institution name"
                  />
                  <SelectField
                    label="Your role"
                    value={form.role}
                    onChange={(v) => setForm({ ...form, role: v })}
                    options={ROLES}
                  />
                </div>

                <TextareaField
                  label="What are you trying to solve? (optional)"
                  value={form.message}
                  onChange={(v) => setForm({ ...form, message: v })}
                />

                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    We respond within one business day. No automated follow-ups.
                  </p>
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--accent-on)",
                      boxShadow: "var(--shadow)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
                  >
                    Send request
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}

function Field({ label, value, onChange, required, placeholder, type = "text" }: FieldProps) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg px-3.5 text-sm outline-none transition-colors"
        style={{
          backgroundColor: "var(--bg-input)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg px-3.5 text-sm outline-none transition-colors"
        style={{
          backgroundColor: "var(--bg-input)",
          border: "1px solid var(--border)",
          color: value ? "var(--text-primary)" : "var(--text-muted)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        <option value="">Select...</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-lg p-3.5 text-sm outline-none transition-colors resize-y"
        style={{
          backgroundColor: "var(--bg-input)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      />
    </label>
  );
}
