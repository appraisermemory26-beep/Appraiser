"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Sparkles,
  TrendingUp,
} from "lucide-react";

/**
 * Pure-CSS faux dashboard preview used in the landing hero.
 * Built entirely from divs so it stays sharp at any resolution.
 */
export function DashboardMock() {
  return (
    <div className="relative">
      {/* Glow */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-3xl blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 30%, var(--accent-muted), transparent 60%), radial-gradient(60% 60% at 80% 80%, var(--purple-muted), transparent 60%)",
        }}
      />

      <div
        className="overflow-hidden rounded-2xl"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          boxShadow: "0 30px 60px -30px rgba(31, 35, 40, 0.18)",
        }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--danger)" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--warning)" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
          </div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Accountability · live
          </p>
          <span className="h-1 w-1 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3 p-4">
          {[
            { label: "Execution", val: "84%", color: "var(--accent)" },
            { label: "On time", val: "91%", color: "var(--accent)" },
            { label: "Alerts", val: "3", color: "var(--danger)" },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl p-3"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                {k.val}
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest" style={{ color: k.color }}>
                {k.label}
              </p>
            </div>
          ))}
        </div>

        {/* Department bars */}
        <div className="px-4 pb-3">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" style={{ color: "var(--purple)" }} />
            <p className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Department performance
            </p>
          </div>
          <div className="space-y-2.5">
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
        </div>

        {/* Alerts row */}
        <div
          className="flex items-center gap-2 border-t px-4 py-3"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--danger)" }} />
          <p className="truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
            <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
              HR
            </span>{" "}
            · 4 overdue · milestone{" "}
            <span style={{ color: "var(--accent)" }}>Review compliance v2</span> due tomorrow
          </p>
        </div>
      </div>

      {/* Floating AI tip card */}
      <div
        className="absolute -bottom-6 -left-6 hidden w-56 rounded-xl p-4 sm:block"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 40px -20px rgba(31, 35, 40, 0.16)",
        }}
      >
        <div className="mb-2 flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{ backgroundColor: "var(--accent-muted)" }}
          >
            <Sparkles className="h-3 w-3" style={{ color: "var(--accent)" }} />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            AI tip
          </p>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
          Two HR tasks have been idle for &gt;48h. Consider reassigning to clear the backlog before quarter-end.
        </p>
      </div>

      {/* Floating success chip */}
      <div
        className="absolute -top-4 -right-4 hidden items-center gap-2 rounded-full px-3 py-1.5 sm:flex"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "0 12px 24px -12px rgba(31, 35, 40, 0.14)",
        }}
      >
        <CheckCircle2 className="h-3 w-3" style={{ color: "var(--accent)" }} />
        <span className="text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Audit log: clean
        </span>
        <TrendingUp className="h-3 w-3" style={{ color: "var(--accent)" }} />
      </div>
    </div>
  );
}
