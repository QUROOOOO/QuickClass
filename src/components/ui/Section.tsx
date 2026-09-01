"use client";

import type { ReactNode } from "react";

interface SectionProps {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/** Semantic section wrapper with soft rounded surface. */
export function Section({ children, className = "", ariaLabel }: SectionProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={`card-surface rounded-lg ${className}`}
    >
      {children}
    </section>
  );
}
