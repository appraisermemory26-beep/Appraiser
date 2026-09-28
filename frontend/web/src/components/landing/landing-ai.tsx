"use client";

import { ArrowRight, FileText, ListChecks, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AICard {
  icon: LucideIcon;
  title: string;
  description: string;
  before: string;
  after: string;
}

const CARDS: AICard[] = [
  {
    icon: ListChecks,
    title: "Milestone extraction",
    description: "Upload a workplan or result framework. The AI extracts milestones, owners and deadlines you can save with one click.",
    before: "workplan_2026.pdf",
    after: "12 milestones · 4 deliverables",
  },
  {
    icon: Sparkles,
    title: "Progress summaries",
    description: "One-click summary of any project, drawn from current task completion, status changes, and uploaded documents.",
    before: "Project · Atlas",
    after: "On track · 2 risks",
  },
  {
    icon: FileText,
    title: "Report drafting",
    description: "Specify a project and reporting period. The AI returns a structured draft you can edit and finalise.",
    before: "Q1 2026",
    after: "5-section draft",
  },
];

export function LandingAI() {
  return (
    <section id="ai" className="py-24 lg:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--accent)" }}
          >
            AI assistance
          </p>
          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "var(--text-primary)" }}
          >
            AI that helps — without taking over.
          </h2>
          <p
            className="mt-4 text-base leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Every output is clearly labelled as an AI-generated draft. Nothing publishes itself,
            nothing hides what it touched, and a human always has the final say.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="rounded-xl p-6"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "var(--accent-muted)" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  </div>
                  <span
                    className="text-[9px] font-semibold uppercase tracking-widest"
                    style={{ color: "var(--text-muted)" }}
                  >
                    AI draft
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  {c.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {c.description}
                </p>

                {/* Before → after */}
                <div
                  className="mt-5 flex items-center gap-2 rounded-lg p-2.5"
                  style={{ backgroundColor: "var(--bg-hover)", border: "1px dashed var(--border)" }}
                >
                  <span
                    className="truncate rounded-md px-2 py-1 text-[10px] font-mono"
                    style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    {c.before}
                  </span>
                  <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "var(--accent)" }} />
                  <span
                    className="truncate rounded-md px-2 py-1 text-[10px] font-semibold"
                    style={{ backgroundColor: "var(--accent-muted)", color: "var(--accent)" }}
                  >
                    {c.after}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
