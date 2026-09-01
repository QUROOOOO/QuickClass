"use client";

import { MotionConfig } from "motion/react";

/**
 * Respects the user's reduced-motion preference globally.
 * MotionConfig reducedMotion="user" disables transform/layout
 * animations automatically for those who opt out, while still
 * animating opacity for non-disorienting feedback.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
