"use client";

import { ChevronDown } from "lucide-react";
import clsx from "clsx";

interface SelectFilterProps {
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function SelectFilter({ label, options, value, onChange, className }: SelectFilterProps) {
  return (
    <div className={clsx("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-11 appearance-none rounded-lg border pl-3 pr-9 text-sm outline-none transition-colors cursor-pointer"
        style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        <option value="">{label}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
    </div>
  );
}
