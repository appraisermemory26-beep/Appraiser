"use client";

import { Check } from "lucide-react";
import clsx from "clsx";

interface Plan {
  name: string;
  pitch: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Basic",
    pitch: "For small teams establishing a structured task and audit foundation.",
    features: [
      "Up to 25 users",
      "Tasks, projects, and policy vault",
      "Audit trail with 10-year retention",
      "Email support",
    ],
  },
  {
    name: "Professional",
    pitch: "For institutions ready to operationalise accountability and AI assistance.",
    features: [
      "Up to 250 users",
      "Everything in Basic",
      "Accountability dashboard with KPI targets",
      "AI assistant + project AI tools",
      "Priority support",
    ],
    highlight: true,
  },
  {
    name: "Enterprise",
    pitch: "For organisations with custom governance, integrations, and deployment needs.",
    features: [
      "Unlimited users",
      "Everything in Professional",
      "SSO and custom RBAC tiers",
      "Dedicated infrastructure",
      "Named technical contact",
    ],
  },
];

export function LandingPricing() {
  return (
    <section
      id="pricing"
      className="py-24 lg:py-28"
      style={{ backgroundColor: "var(--bg-secondary)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--accent)" }}
          >
            Pricing
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--text-primary)" }}>
            Three tiers. Built for how institutions actually grow.
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Final pricing depends on your organisation size and deployment model.
            Talk to us — we&apos;ll send a quote within one business day.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={clsx("relative rounded-2xl p-7 transition-all duration-200")}
              style={{
                backgroundColor: "var(--bg-card)",
                border: p.highlight ? "1px solid var(--accent)" : "1px solid var(--border)",
                boxShadow: p.highlight ? "0 0 0 4px var(--accent-muted)" : "none",
              }}
            >
              {p.highlight && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
                >
                  Most popular
                </span>
              )}

              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {p.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {p.pitch}
              </p>

              <div className="my-6 h-px" style={{ backgroundColor: "var(--border)" }} />

              <ul className="space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="#contact"
                className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors"
                style={
                  p.highlight
                    ? { backgroundColor: "var(--accent)", color: "var(--accent-on)" }
                    : { color: "var(--text-primary)", border: "1px solid var(--border)" }
                }
                onMouseEnter={(e) => {
                  if (p.highlight) e.currentTarget.style.backgroundColor = "var(--accent-hover)";
                  else {
                    e.currentTarget.style.borderColor = "var(--accent-muted)";
                    e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (p.highlight) e.currentTarget.style.backgroundColor = "var(--accent)";
                  else {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                Talk to sales
              </a>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs" style={{ color: "var(--text-muted)" }}>
          All tiers include the full audit trail, 10-year retention, and board-governed deletion.
        </p>
      </div>
    </section>
  );
}
