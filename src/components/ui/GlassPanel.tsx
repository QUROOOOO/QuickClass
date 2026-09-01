"use client";

import type { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}

/** Selective glass — used for floating/inspector/overlay surfaces only. */
export function GlassPanel({ children, className = "", strong }: GlassPanelProps) {
  return (
    <div className={`${strong ? "glass-strong" : "glass"} rounded-xl ${className}`}>
      {children}
    </div>
  );
}
