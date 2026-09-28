"use client";

import {
  CheckSquare,
  FolderKanban,
  Bot,
  ShieldCheck,
  Shield,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Module {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const MODULES: Module[] = [
  {
    icon: CheckSquare,
    title: "Tasks",
    desc: "Six-state lifecycle with server-enforced transitions, audit-logged on every change.",
  },
  {
    icon: FolderKanban,
    title: "Projects",
    desc: "Workplans, milestones, document vault, and AI-drafted progress reports per period.",
  },
  {
    icon: Bot,
    title: "AI Assistant",
    desc: "JD generation, NL search across the platform, and persistent chat history per user.",
  },
  {
    icon: ShieldCheck,
    title: "Policy Vault",
    desc: "Versioned policies with per-employee acknowledgments and re-ack on every update.",
  },
  {
    icon: Shield,
    title: "Audit Trail",
    desc: "Every significant action logged with actor, timestamp, and entity. Never editable.",
  },
  {
    icon: BarChart3,
    title: "Accountability",
    desc: "Execution score, ranked department performance, KPI targets and live alerts.",
  },
];

export function LandingModules() {
  return (
    <section id="modules" className="py-24 lg:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--accent)" }}
          >
            Modules
          </p>
          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "var(--text-primary)" }}
          >
            Everything an institution actually runs on.
          </h2>
          <p
            className="mt-4 text-base leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Six tightly integrated modules, all working from the same audit-trailed source of truth.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.title}
                className="group rounded-xl p-6 transition-all duration-200 ease-out"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = "var(--accent-muted)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                <div
                  className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--accent-muted)" }}
                >
                  <Icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
                </div>
                <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  {m.title}
                </h3>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {m.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
