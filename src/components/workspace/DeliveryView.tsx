"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { Plan } from "@/types/plan";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { IconLaunch, IconArrow } from "@/components/ui/Icon";
import { api } from "@/lib/api";

interface DeliveryViewProps {
  plan: Plan;
  onReset: () => void;
}

/**
 * FINAL DELIVERY — calm, professional completion.
 * Real numbers from the backend, honest deployment state, no confetti.
 */
export function DeliveryView({ plan, onReset }: DeliveryViewProps) {
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

  const tasksDone = plan.tasks.filter((t) => t.status === "done").length;
  const tasksTotal = plan.tasks.length;
  const succeededRuns = (runs ?? []).filter((r) => r.status === "succeeded").length;
  const planOnly = (runs ?? []).every((r) => String(r.summary ?? "").includes("(plan-only)"));

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-12 lg:py-20">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-12"
      >
        <p className="label-micro text-success mb-3">Complete</p>
        <h1 className="display text-display-lg">
          <span className="text-text-primary font-medium">{plan.goal}</span> is
          <span className="text-success"> done.</span>
        </h1>
        <p className="mt-4 text-[14px] text-text-secondary max-w-md mx-auto">
          The build was verified against the blueprint and marked complete
          in the backend. What happens next is yours to decide.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10"
      >
        <Stat label="Tasks" value={`${tasksDone}/${tasksTotal}`} hint="completed" tone="success" />
        <Stat label="Agent runs" value={runs === null ? "…" : String(succeededRuns)} hint="succeeded" tone="success" />
        <Stat label="Artifacts" value={artifacts === null ? "…" : String(artifacts.length)} hint="produced" tone="accent" />
        <Stat label="Deployment" value="Not done" hint="no deploy ran" tone="warning" />
      </motion.div>

      {/* deployment status — honest */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="card-raised p-6 mb-10"
      >
        <p className="label-micro mb-4">Deployment</p>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          Nothing was deployed. Deploying is an explicit, human-approved
          step in Code Butler — if you want this build live, connect a
          deployment target and approve the publish.
        </p>
      </motion.div>

      {planOnly && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="card-surface p-6 mb-10"
        >
          <p className="label-micro mb-3">Known limitation</p>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            This build ran in plan-only mode — no agent model is configured,
            so no code was actually produced. Configure CB_AGENT_MODEL and a
            model key to run real agents.
          </p>
        </motion.div>
      )}

      {/* actions — professional, restrained */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        <Button size="lg" variant="secondary" disabled className="rounded-xl">
          <IconLaunch size={14} /> Deploy
        </Button>
        <Button size="lg" variant="ghost" onClick={onReset} className="rounded-xl">
          <IconArrow size={13} className="rotate-180" /> Start something new
        </Button>
      </motion.div>
    </div>
  );
}