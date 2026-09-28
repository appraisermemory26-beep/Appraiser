"use client";

import { type SelectHTMLAttributes } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label: string;
  name: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
}

export function FormSelect({ label, name, options, error, placeholder, className, ...props }: FormSelectProps) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {label}
        {props.required && <span className="ml-1" style={{ color: "var(--danger)" }}>*</span>}
      </label>
      <select
        id={name}
        name={name}
        className={`h-11 w-full rounded-lg border px-3.5 text-sm outline-none transition-colors focus:ring-1 appearance-none cursor-pointer ${className ?? ""}`}
        style={{ backgroundColor: "var(--bg-input)", borderColor: error ? "var(--danger)" : "var(--border)", color: "var(--text-primary)" }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
