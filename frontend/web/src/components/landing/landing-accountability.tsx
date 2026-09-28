"use client";

import { AlertTriangle, Target, TrendingUp } from "lucide-react";

export function LandingAccountability() {
  const score = 84;

  return (
    <section
      id="accountability"
      className="py-24 lg:py-28"
      style={{ backgroundColor: "var(--bg-secondary)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-16">
        {/* Copy */}
        <div>
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--accent)" }}
          >
            Accountability dashboard
          </p>
          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ color: "var(--text-primary)" }}
          >
            Real-time organisational health for executives and the board.
          </h2>
          <p
            className="mt-4 text-base leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Execution score, ranked department performance, project health, and live alerts —
            recalculated every 60 seconds. Without ever surfacing an individual staff member&apos;s record.
          </p>

          <ul className="mt-6 space-y-3">
            {[
              { icon: TrendingUp, text: "Execution score blends task completion and on-time delivery." },
              { icon: Target, text: "KPI targets set by the board, compared against live actuals with green/amber/red status." },
              { icon: AlertTriangle, text: "Live alerts for overdue tasks and delayed milestones, with one-click drill-down." },
            ].map((b, i) => {
              const Icon = b.icon;
              return (
                <li key={i} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: "var(--accent-muted)" }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {b.text}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Mock */}
        <div
          className="relative rounded-2xl p-6"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 30px 60px -30px rgba(31, 35, 40, 0.18)" }}
        >
          <div className="mb-5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Q1 · Live
            </p>
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--accent-muted)", color: "var(--accent)" }}>
              Healthy
            </span>
          </div>

          {/* Ring */}
          <div className="mx-auto flex h-44 w-44 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="2.5" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeDasharray={`${score} ${100 - score}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                {score}%
              </p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Execution
              </p>
            </div>
          </div>

          {/* Bars */}
          <div className="mt-6 space-y-2.5">
            {[
              { name: "Operations", pct: 92, color: "var(--accent)" },
              { name: "Engineering", pct: 78, color: "var(--accent)" },
              { name: "Finance", pct: 64, color: "var(--warning)" },
              { name: "HR", pct: 41, color: "var(--danger)" },
            ].map((d) => (
              <div key={d.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {d.name}
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: d.color }}>
                    {d.pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-hover)" }}>
                  <div className="h-full rounded-full" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Alert chip */}
          <div
            className="mt-5 flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--danger-muted)", border: "1px solid rgba(248,81,73,0.18)" }}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--danger)" }} />
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                HR
              </span>{" "}
              · 4 overdue tasks · milestone <em>Compliance review</em> due tomorrow
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
