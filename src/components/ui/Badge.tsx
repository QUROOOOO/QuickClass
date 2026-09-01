"use client";

import type { ReactNode } from "react";

type Tone = "accent" | "neutral" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}

const TONES: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent-strong",
  neutral: "bg-surface-tertiary text-text-secondary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-error-soft text-error",
  info: "bg-info-soft text-info",
};

const DOTS: Record<Tone, string> = {
  accent: "bg-accent",
  neutral: "bg-text-muted",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
};

export function Badge({ children, tone = "neutral", dot }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${TONES[tone]}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOTS[tone]}`} />}
      {children}
    </span>
  );
}
