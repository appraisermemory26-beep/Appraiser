"use client";

import {
  User,
  Users,
  Building2,
  Briefcase,
  Crown,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Role {
  icon: LucideIcon;
  title: string;
  description: string;
}

const ROLES: Role[] = [
  {
    icon: User,
    title: "Staff",
    description: "Personal task list, progress tracking, activity logs, policy acknowledgments and AI coaching tips.",
  },
  {
    icon: Users,
    title: "Manager",
    description: "Team overview, submission review queue, time-on-task summaries, broadcast messaging.",
  },
  {
    icon: Building2,
    title: "Department Head",
    description: "Cross-team task status, department KPIs, productivity summaries, and policy adherence rates.",
  },
  {
    icon: Briefcase,
    title: "Executive",
    description: "Company-wide metrics, project health, accountability dashboard and KPI status.",
  },
  {
    icon: Crown,
    title: "Board Member",
    description: "Read-only KPI targets, accountability dashboard, and dual-approval document deletion governance.",
  },
  {
    icon: Shield,
    title: "Admin",
    description: "User lifecycle, organisation structure, billing, alert thresholds and the system-wide audit trail.",
  },
];

export function LandingRoles() {
  return (
    <section className="py-24 lg:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--accent)" }}
          >
            Roles
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: "var(--text-primary)" }}>
            One platform, six perspectives.
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Each role gets exactly the dashboard, controls, and visibility they need — and nothing more.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.title}
                className="rounded-xl p-6"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "var(--accent-muted)" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  </div>
                  <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                    {r.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {r.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
