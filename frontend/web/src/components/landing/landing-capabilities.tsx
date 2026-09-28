"use client";

import { Building2, FileLock2, Gavel, ShieldCheck } from "lucide-react";

const ITEMS = [
  { icon: ShieldCheck, label: "10-year retention", sub: "enforced by default" },
  { icon: FileLock2, label: "Immutable", sub: "audit & messaging" },
  { icon: Building2, label: "Multi-tenant", sub: "row-level isolation" },
  { icon: Gavel, label: "Board-approved", sub: "deletion governance" },
];

export function LandingCapabilities() {
  return (
    <section
      className="border-y"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-secondary)",
      }}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-6 px-6 py-8 sm:grid-cols-4 sm:divide-x">
        {ITEMS.map((it, i) => {
          const Icon = it.icon;
          return (
            <div
              key={it.label}
              className={
                i > 0
                  ? "sm:pl-8 flex items-center gap-3"
                  : "flex items-center gap-3"
              }
              style={{
                borderColor: "var(--border)",
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: "var(--accent-muted)" }}
              >
                <Icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {it.label}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {it.sub}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
