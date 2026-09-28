"use client";

import clsx from "clsx";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-2.5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, style, children, ...props }, ref) => {
    const variantInlineStyle: Record<ButtonVariant, React.CSSProperties> = {
      primary: { backgroundColor: "var(--accent)", color: "var(--accent-on)" },
      secondary: { border: "1px solid var(--border)", color: "var(--text-primary)" },
      danger: { backgroundColor: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)" },
      ghost: { color: "var(--text-secondary)" },
    };

    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
          sizeStyles[size],
          variant === "primary" && "font-semibold shadow-lg",
          className
        )}
        style={{ ...variantInlineStyle[variant], ...style }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
