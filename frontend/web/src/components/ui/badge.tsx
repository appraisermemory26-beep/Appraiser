"use client";

import clsx from "clsx";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral" | "purple" | "orange";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  success: { backgroundColor: "rgba(74, 222, 128, 0.15)", color: "var(--accent)", borderColor: "rgba(74, 222, 128, 0.2)" },
  warning: { backgroundColor: "rgba(240, 180, 41, 0.15)", color: "var(--warning)", borderColor: "rgba(240, 180, 41, 0.2)" },
  danger: { backgroundColor: "rgba(248, 81, 73, 0.15)", color: "var(--danger)", borderColor: "rgba(248, 81, 73, 0.2)" },
  info: { backgroundColor: "rgba(88, 166, 255, 0.15)", color: "var(--info)", borderColor: "rgba(88, 166, 255, 0.2)" },
  neutral: { backgroundColor: "rgba(139, 148, 158, 0.15)", color: "var(--text-secondary)", borderColor: "rgba(139, 148, 158, 0.2)" },
  purple: { backgroundColor: "rgba(188, 140, 255, 0.15)", color: "var(--purple)", borderColor: "rgba(188, 140, 255, 0.2)" },
  orange: { backgroundColor: "rgba(210, 153, 34, 0.15)", color: "var(--orange)", borderColor: "rgba(210, 153, 34, 0.2)" },
};

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        className
      )}
      style={variantStyles[variant]}
    >
      {children}
    </span>
  );
}
