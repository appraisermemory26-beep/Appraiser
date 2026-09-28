"use client";

import { type InputHTMLAttributes } from "react";

interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  name: string;
  error?: string;
}

export function FormInput({ label, name, error, className, ...props }: FormInputProps) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {label}
        {props.required && <span className="ml-1" style={{ color: "var(--danger)" }}>*</span>}
      </label>
      <input
        id={name}
        name={name}
        className={`h-11 w-full rounded-lg border px-3.5 text-sm outline-none transition-colors focus:ring-1 ${className ?? ""}`}
        style={{
          backgroundColor: "var(--bg-input)",
          borderColor: error ? "var(--danger)" : "var(--border)",
          color: "var(--text-primary)",
          ...(error ? {} : {}),
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? "var(--danger)" : "var(--accent)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? "var(--danger)" : "var(--border)";
        }}
        {...props}
      />
      {error && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
