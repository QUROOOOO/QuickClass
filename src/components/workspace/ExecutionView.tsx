"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { Plan } from "@/types/plan";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { StatusDot } from "@/components/ui/StatusDot";
import { IconShield, IconFile, IconActivity, IconClock } from "@/components/ui/Icon";
import { api } from "@/lib/api";

interface ExecutionViewProps {
  plan: Plan;
  busy?: boolean;
  onExecute: () => Promise<unknown>;
  onReview: () => void;
}

/**
 * EXECUTION WORKSPACE — autonomy made controllable.
 * Shows the REAL state from the backend: recorded agent runs, artifacts,
 * task statuses. In plan-only mode (no model key configured) runs carry
 * an honest "(plan-only)" note — nothing pretends an agent worked.
 */
export function ExecutionView({ plan, busy, onExecute, onReview }: ExecutionViewProps) {
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

  const done = plan.tasks.filter((t) => t.status === "done");
  const pending = plan.tasks.filter((t) => t.status === "pending");
  const blocked = plan.tasks.filter((t) => t.status === "blocked");
  const running = plan.tasks.filter((t) => t.status === "running");
  const succeededRuns = (runs ?? []).filter((r) => r.status === "succeeded");
  const planOnly = (runs ?? []).every((r) => String(r.summary ?? "").includes("(plan-only)"));

  const current = running[0] ?? plan.tasks.find((t) => t.status === "pending");

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8 lg:py-12">
      <div className="mb-8">
        <p className="label-micro text-text-secondary mb-2">Execution</p>
        <h1 className="display text-display-md sm:text-display-lg">
          Building <span className="text-accent">quietly.</span>
        </h1>
        <p className="mt-3 text-[14px] text-text-secondary max-w-xl">
          {planOnly
            ? "No agent model is configured, so execution ran in plan-only mode — work records were kept, nothing was faked."
            : "Agents are working through the blueprint. You stay in control — nothing ships without your review."}
        </p>
      </div>

      {/* stat strip — real numbers only */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Tasks" value={`${done.length}/${plan.tasks.length}`} hint="completed" tone={done.length === plan.tasks.length && plan.tasks.length > 0 ? "success" : "accent"} />
        <Stat label="Agent runs" value={`${runs === null ? "…" : succeededRuns.length}`} hint="recorded" tone="accent" />
        <Stat label="Artifacts" value={`${artifacts === null ? "…" : artifacts.length}`} hint="produced" tone="accent" />
        <Stat label="Blocked" value={`${blocked.length}`} hint="waiting on input" tone={blocked.length ? "warning" : "default"} />
      </div>

      {/* current work */}
      {current ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-raised p-6 mb-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <StatusDot status="running" pulse />
            <p className="label-micro text-text-secondary">Currently working</p>
          </div>
          <h2 className="text-[16px] font-semibold text-text-primary leading-snug">{current.title}</h2>
          <p className="text-[13px] text-text-secondary mt-1">{current.description}</p>
          <div className="mt-5 grid sm:grid-cols-2 gap-2">
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-surface-secondary/60">
              <IconActivity size={14} className="text-text-muted" />
              <span className="label-caps text-text-muted">Plan version</span>
              <span className="ml-auto data-text text-[11px] text-text-primary">v{plan.plan_version}</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-surface-secondary/60">
              <IconClock size={14} className="text-text-muted" />
              <span className="label-caps text-text-muted">Depends on</span>
              <span className="ml-auto data-text text-[11px] text-text-primary">
                {current.dependencies.length ? current.dependencies.length : "nothing"}
              </span>
            </div>
          </div>
        </motion.div>
      ) : done.length > 0 ? (
        <div className="card-raised p-6 mb-4 flex items-center gap-3">
          <StatusDot status="done" />
          <p className="text-[13.5px] text-text-secondary">
            All {done.length} blueprint task{done.length > 1 ? "s" : ""} complete{done.length === plan.tasks.length ? " — execution finished." : "."}
          </p>
        </div>
      ) : null}

      {/* advance — execution is a real backend step */}
      <div className="flex items-center gap-3 mb-8">
        {pending.length > 0 || runs === null ? (
          <Button size="md" disabled={busy} onClick={() => void onExecute()}>
            {busy ? "Running…" : "Run execution"}
          </Button>
        ) : (
          <Button size="md" onClick={onReview}>Review build</Button>
        )}
        <p className="text-[12.5px] text-text-secondary">
          {pending.length > 0 || runs === null
            ? "Tasks are queued — execution has not run yet."
            : "Blueprint tasks complete — move to verification."}
        </p>
      </div>

      {/* pipeline queue — real statuses */}
      <div className="card-surface p-5 mb-4">
        <p className="label-micro mb-4">Pipeline</p>
        <div className="space-y-1">
          {[...done.map((t) => ({ ...t, phase: "done" as const })),
            ...running.map((t) => ({ ...t, phase: "running" as const })),
            ...pending.map((t) => ({ ...t, phase: "pending" as const })),
          ].map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2">
              <StatusDot
                status={t.phase === "done" ? "done" : t.phase === "running" ? "running" : "pending"}
                pulse={t.phase === "running"}
              />
              <span className={`text-[13px] flex-1 ${t.phase === "pending" ? "text-text-faint" : "text-text-primary"}`}>
                {t.title}
              </span>
              <Badge tone={t.phase === "done" ? "success" : t.phase === "running" ? "accent" : "neutral"}>
                {t.phase}
              </Badge>
            </div>
          ))}
          {blocked.length > 0 && (
            <div className="flex items-center gap-3 py-2 mt-2 pt-3 border-t border-border">
              <StatusDot status="blocked" />
              <span className="text-[13px] text-error flex-1">Waiting on your decision</span>
              <Badge tone="error">blocked</Badge>
            </div>
          )}
        </div>
      </div>

      {/* security / approval banner */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-lg bg-surface-secondary/60 border border-border">
        <IconShield size={18} className="text-info" />
        <p className="text-[13px] text-text-secondary flex-1">
          Nothing is pushed or deployed without your explicit approval.
        </p>
        <Badge tone="info">Safe by default</Badge>
      </div>
    </div>
  );
}