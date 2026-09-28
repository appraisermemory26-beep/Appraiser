"use client";

import { Building2, FileLock2, Gavel, Key } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Pillar {
  icon: LucideIcon;
  title: string;
  description: string;
}

const PILLARS: Pillar[] = [
  {
    icon: Building2,
    title: "Row-level multi-tenancy",
    description:
      "Every record carries an organisation foreign key. Querysets are scoped at the permission and view layer — no organisation can read another's data.",
  },
  {
    icon: Key,
    title: "JWT + RBAC",
    description:
      "Six-tier role hierarchy from Staff to Board to Admin, with custom JWT authentication that rejects tokens for non-Active users immediately.",
  },
  {
    icon: FileLock2,
    title: "Immutable records",
    description:
      "Audit log entries and messages cannot be edited or deleted. Save and delete overrides raise at the model level — defence in depth.",
  },
  {
    icon: Gavel,
    title: "Board-governed deletion",
    description:
      "Documents are retained for 10 years. Removal requires a board member to initiate and a second board member to approve, fully audited.",
  },
];

export function LandingSecurity() {
  return (
    <section
      id="security"
      className="py-24 lg:py-28"
      style={{ backgroundColor: "var(--bg-secondary)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--accent)" }}
          >
            Security & governance
          </p>
          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "var(--text-primary)" }}
          >
            Built for institutions that can&apos;t afford to forget.
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Trust isn&apos;t a feature flag. It&apos;s baked into the data model, the API,
            and the governance workflows.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="rounded-xl p-7"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "var(--accent-muted)" }}
                  >
                    <Icon className="h-4.5 w-4.5" style={{ color: "var(--accent)" }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                      {p.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {p.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
