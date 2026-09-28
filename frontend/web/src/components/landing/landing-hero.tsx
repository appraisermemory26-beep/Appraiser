"use client";

import { ArrowRight } from "lucide-react";
import { DashboardMock } from "./dashboard-mock";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 lg:pt-40 lg:pb-32">
      {/* Subtle dotted grid */}
      <div className="landing-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />

      {/* Soft accent halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[1100px] -translate-x-1/2 -z-10 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, var(--accent-muted), transparent 70%)",
        }}
      />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        {/* Copy */}
        <div>
          <p
            className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--accent)" }}
          >
            Built for Institutional Memory
          </p>
          <h1
            className="text-[40px] font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[58px]"
            style={{ color: "var(--text-primary)" }}
          >
            The performance platform
            <br />
            that{" "}
            <span style={{ color: "var(--accent)" }}>remembers</span>{" "}
            every decision.
          </h1>
          <p
            className="mt-6 max-w-[560px] text-base leading-relaxed sm:text-lg"
            style={{ color: "var(--text-secondary)" }}
          >
            Tasks, projects, AI, audit and accountability — in one institution-grade
            platform with a permanent record of every action, output, and outcome.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#contact"
              className="inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold transition-colors"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-on)",
                boxShadow: "var(--shadow)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
            >
              Request a demo
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#modules"
              className="inline-flex h-11 items-center rounded-lg px-5 text-sm font-semibold transition-colors"
              style={{
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-muted)";
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              See it in action
            </a>
          </div>

          <p className="mt-5 text-xs" style={{ color: "var(--text-muted)" }}>
            Multi-tenant by design · 10-year retention · Live deployed in days
          </p>
        </div>

        {/* Dashboard mock */}
        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}
