"use client";

import clsx from "clsx";
import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  labelColor?: string;
  className?: string;
}

export function StatsCard({ label, value, icon: Icon, labelColor, className }: StatsCardProps) {
  return (
    <div
      className={clsx("rounded-xl p-6 min-w-0 transition-colors theme-glass", className)}
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className="truncate text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: labelColor || "var(--text-secondary)" }}
        >
          {label}
        </p>
        {Icon && (
          <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--text-muted)" }} />
        )}
      </div>
      <p className="mt-3 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}
