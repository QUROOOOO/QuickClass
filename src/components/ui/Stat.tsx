"use client";

interface StatProps {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "success" | "warning";
  trend?: "up" | "down" | "neutral";
}

const TONES = {
  default: "text-text-primary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
};

export function Stat({ label, value, hint, tone = "default", trend }: StatProps) {
  return (
    <div className="card-surface p-4 flex flex-col gap-1 min-w-0">
      <p className="label-micro">{label}</p>
      <p className={`text-[22px] leading-tight font-semibold tracking-tight ${TONES[tone]}`}>
        {value}
      </p>
      {hint && (
        <p className="text-[11.5px] text-text-secondary flex items-center gap-1">
          {trend === "up" && <span className="text-success">↑</span>}
          {trend === "down" && <span className="text-error">↓</span>}
          {trend === "neutral" && <span className="text-text-faint">—</span>}
          {hint}
        </p>
      )}
    </div>
  );
}
