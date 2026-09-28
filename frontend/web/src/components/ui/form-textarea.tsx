"use client";

import { type TextareaHTMLAttributes } from "react";

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: string;
  error?: string;
}

export function FormTextarea({ label, name, error, className, ...props }: FormTextareaProps) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {label}
        {props.required && <span className="ml-1" style={{ color: "var(--danger)" }}>*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        rows={props.rows ?? 4}
        className={`w-full rounded-lg border px-3.5 py-3 text-sm outline-none transition-colors focus:ring-1 resize-y ${className ?? ""}`}
        style={{ backgroundColor: "var(--bg-input)", borderColor: error ? "var(--danger)" : "var(--border)", color: "var(--text-primary)" }}
        {...props}
      />
      {error && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
