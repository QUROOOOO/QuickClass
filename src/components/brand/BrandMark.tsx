"use client";

interface BrandMarkProps {
  className?: string;
}

/**
 * QUICKCLASS mark — graduation cap / open book.
 * Clean geometric mark: a stylized open book with a graduation
 * cap silhouette, signaling learning and mastery.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      {/* graduation cap — top diamond */}
      <path
        d="M20 6L4 15l16 9 16-9L20 6z"
        fill="currentColor"
      />
      {/* cap tassel line */}
      <path
        d="M32 15v8"
        stroke="#ED6A2F"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* tassel dot */}
      <circle cx="32" cy="25" r="1.5" fill="#ED6A2F" />
      {/* book pages below */}
      <path
        d="M8 18v10c0 2 5.4 4 12 4s12-2 12-4V18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* center spine */}
      <path
        d="M20 18v14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
