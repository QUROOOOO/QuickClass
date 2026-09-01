"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-shell hover:bg-ink-strong shadow-active",
  secondary:
    "bg-surface-primary text-text-primary border border-border hover:border-border-strong hover:shadow-rest",
  ghost: "bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-secondary",
  danger: "bg-transparent text-error border border-error/20 hover:bg-error/10",
};

const SIZES: Record<Size, string> = {
  sm: "px-3.5 py-2 text-[12.5px] gap-1.5 rounded-control",
  md: "px-4 py-2.5 text-[13px] gap-2 rounded-control",
  lg: "px-6 py-3 text-[14px] gap-2 rounded-control",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", fullWidth, className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`control inline-flex items-center justify-center font-medium select-none
          active:scale-[0.97] transition-transform
          disabled:opacity-40 disabled:pointer-events-none
          ${VARIANTS[variant]} ${SIZES[size]}
          ${fullWidth ? "w-full" : ""} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";