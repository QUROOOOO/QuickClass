"use client";

type Status = "done" | "running" | "pending" | "blocked" | "failed" | "idle";

const MAP: Record<Status, string> = {
  done: "bg-success",
  running: "bg-accent animate-pulse-dot",
  pending: "bg-text-faint",
  blocked: "bg-error",
  failed: "bg-error",
  idle: "bg-text-faint",
};

export function StatusDot({ status, pulse }: { status: Status; pulse?: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${MAP[status]} ${pulse ? "animate-pulse-dot" : ""}`}
      aria-hidden="true"
    />
  );
}
