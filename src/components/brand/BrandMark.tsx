"use client";

interface BrandMarkProps {
  className?: string;
}

/**
 * CODE BUTLER mark — geometric "G" aperture.
 *
 * A bold circular form with a deliberate opening on the right,
 * a flat diagonal inner cut forming the bar, and a small accent
 * bead seated at the upper-right terminal. Pure geometry, crisp
 * at every size, reads in #000000 and #F0F0F0.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      {/* ring — open on the right, sweeping from the upper terminal over the top */}
      <path
        d="M25.9 13.6 A 10.4 10.4 0 1 0 29.6 24.1"
        stroke="currentColor"
        strokeWidth="6.2"
      />
      {/* bar — flat top, single diagonal cut on its left end */}
      <path d="M33.4 17.7 L17.9 17.7 L14.2 23.9 L33.4 23.9 Z" fill="currentColor" />
      {/* accent bead — upper-right terminal */}
      <circle cx="27.5" cy="11.4" r="2.75" fill="#ED6A2F" />
    </svg>
  );
}
