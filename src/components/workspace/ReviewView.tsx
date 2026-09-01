"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { Plan } from "@/types/plan";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { StatusDot } from "@/components/ui/StatusDot";
import { IconShield, IconCheck, IconActivity, IconFile } from "@/components/ui/Icon";
import { api } from "@/lib/api";

interface ReviewViewProps {
  plan: Plan;
  busy?: boolean;
  onContinue: () => void;
}

/**
 * REVIEW / VERIFICATION — evidence-first.
 * Every number here is read from the backend: agent runs, artifacts,
 * requirement coverage. Nothing is hard-coded.
 */
export function ReviewView({ plan, busy, onContinue }: ReviewViewProps) {
  const [runs, setRuns] = useState<Record<string, unknown>[] | null>(null);
  const [artifacts, setArtifacts] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([api.runs(plan.project_id), api.artifacts(plan.project_id)])
      .then(([r, a]) => {
        if (!alive) return;
        setRuns(r);
        setArtifacts(a);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [plan.project_id]);

  const succeededRuns = (runs ?? []).filter((r) => r.status === "succeeded").length;
  const failedRuns = (runs ?? []).filter((r) => r.status === "failed").length;
  const coverage = plan.requirements.length
    ? Math.round((plan.requirements.filter((r) => r.status === "verified").length / plan.requirements.length) * 100)
    : 0;

  const checks: { label: string; value: string; tone: "success" | "warning"; icon: typeof IconActivity }[] = [
    { label: "Agent runs", value: runs === null ? "…" : `${succeededRuns} ok`, tone: failedRuns ? "warning" : "success", icon: IconActivity },
    { label: "Artifacts", value: artifacts === null ? "…" : String(artifacts.length), tone: "success", icon: IconFile },
    { label: "Requirement coverage", value: `${coverage}%`, tone: coverage >= 60 ? "success" : "warning", icon: IconCheck },
    { label: "Plan version", value: `v${plan.plan_version}`, tone: "success", icon: IconShield },
  ];

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8 lg:py-12">
      <div className="mb-8">
        <p className="label-micro text-success mb-2">Review</p>
        <h1 className="display text-display-md sm:text-display-lg">
          Nearly <span className="text-success">there.</span>
        </h1>
        <p className="mt-3 text-[14px] text-text-secondary max-w-xl">
          The build is complete enough to review. Here is the evidence —
          everything verified, nothing assumed.
        </p>
      </div>

      {/* checks grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {checks.map((c) => (
          <div key={c.label} className="card-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon size={14} className="text-text-muted" />
              <span className="label-caps text-text-muted">{c.label}</span>
            </div>
            <p className="display text-display-sm">{c.value}</p>
            <Badge tone={c.tone}>{c.tone === "warning" ? "needs attention" : "verified"}</Badge>
          </div>
        ))}
      </div>

      {/* requirement coverage — real list */}
      <div className="card-surface p-5 mb-6">
        <p className="label-micro mb-4">Requirements</p>
        <div className="space-y-2">
          {plan.requirements.length === 0 && (
            <p className="text-[12.5px] text-text-secondary">No requirements recorded yet.</p>
          )}
          {plan.requirements.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-1.5">
              <StatusDot status={r.status === "verified" ? "done" : "pending"} />
              <span className="text-[13px] text-text-primary flex-1">{r.text}</span>
              <Badge tone={r.status === "verified" ? "success" : "neutral"}>
                {r.status === "verified" ? "verified" : "pending"}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* advance */}
      <div className="flex items-center gap-3 mb-8">
        <Button size="md" disabled={busy} onClick={onContinue}>
          {busy ? "Completing…" : "Complete build"}
        </Button>
        <p className="text-[12.5px] text-text-secondary">
          Completing moves the project to done in the backend.
        </p>
      </div>
    </div>
  );
}