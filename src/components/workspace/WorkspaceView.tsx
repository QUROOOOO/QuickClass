"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrent, type CurrentState } from "@/components/current/CodeCurrentContext";
import { PixelField } from "@/components/background/PixelField";
import { motion, AnimatePresence } from "motion/react";
import type { Plan, TechChoice, DecisionSource } from "@/types/plan";
import type { BudgetPauseRecord } from "@/lib/api";
import { ContextInspector } from "./ContextInspector";
import { PlanningView } from "./PlanningView";
import { ExecutionView } from "./ExecutionView";
import { ReviewView } from "./ReviewView";
import { DeliveryView } from "./DeliveryView";
import { Button } from "@/components/ui/Button";
import { IconArrow } from "@/components/ui/Icon";

type Stage = "plan" | "build" | "review" | "delivery";

interface WorkspaceViewProps {
  plan: Plan;
  status: string;
  invalidated: string[];
  pendingApprovals: number;
  budgetPause: BudgetPauseRecord | null;
  error: string | null;
  onEditTechChoice: (name: string, status: TechChoice["status"], source: DecisionSource) => Promise<unknown>;
  onApprove: () => Promise<unknown>;
  onExecute: () => Promise<unknown>;
  onContinue: () => Promise<unknown>;
  onResolveApproval: (approvalId: string, decision: "approve" | "deny") => Promise<unknown>;
  onResolveBudget: (decision: "continue" | "stop") => Promise<unknown>;
  onReset: () => void;
}

type Selection = {
  kind: "section" | "task" | "decision" | "none";
  id?: string;
  label?: string;
};

const STAGES: { id: Stage; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "build", label: "Build" },
  { id: "review", label: "Review" },
  { id: "delivery", label: "Delivery" },
];

/** Backend status → the stage the human sees. Honest: stages only advance
 *  when the backend actually moves. */
function stageFor(status: string): Stage {
  switch (status) {
    case "executing":
    case "testing":
    case "blocked":
    case "budget_paused":
      return "build";
    case "reviewing":
    case "repairing":
    case "verified":
      return "review";
    case "completed":
      return "delivery";
    default:
      return "plan";
  }
}

export function WorkspaceView({
  plan,
  status,
  invalidated,
  pendingApprovals,
  budgetPause,
  error,
  onEditTechChoice,
  onApprove,
  onExecute,
  onContinue,
  onResolveApproval,
  onResolveBudget,
  onReset,
}: WorkspaceViewProps) {
  const [stage, setStage] = useState<Stage>(stageFor(status));
  const [busy, setBusy] = useState<"approve" | "execute" | "continue" | null>(null);
  const [justInvalidated, setJustInvalidated] = useState(false);
  const { setState: setCurrent } = useCurrent();

  useEffect(() => {
    setStage(stageFor(status));
  }, [status]);

  // the field mirrors the build
  useEffect(() => {
    const map: Record<Stage, CurrentState> = {
      plan: "planning",
      build: "execution",
      review: "focus",
      delivery: "success",
    };
    setCurrent(map[stage]);
    return () => setCurrent("idle");
  }, [stage, setCurrent]);

  useEffect(() => {
    if (invalidated.length > 0) {
      setJustInvalidated(true);
      const t = setTimeout(() => setJustInvalidated(false), 6000);
      return () => clearTimeout(t);
    }
  }, [invalidated]);

  const [selection, setSelection] = useState<Selection>({ kind: "none" });
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const selectSection = (id: string) => {
    setSelection({ kind: "section", id });
    setInspectorOpen(true);
  };

  const handleApprove = useCallback(async () => {
    setBusy("approve");
    try {
      await onApprove(); // submit + approve against the backend
      await onExecute(); // execution is a real, separate step
    } catch {
      /* error banner shows the truth */
    } finally {
      setBusy(null);
    }
  }, [onApprove, onExecute]);

  const handleContinue = useCallback(async () => {
    setBusy("continue");
    try {
      await onContinue();
    } finally {
      setBusy(null);
    }
  }, [onContinue]);

  const handleExecuteFromBuild = useCallback(async () => {
    setBusy("execute");
    try {
      await onExecute();
    } finally {
      setBusy(null);
    }
  }, [onExecute]);

  const stageIndex = STAGES.findIndex((s) => s.id === stage);
  const showError = error && stage !== "plan";

  return (
    <div className="relative flex flex-col min-h-full">
      <PixelField />
      {/* Stage rail — segmented, progressive */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-5 sm:px-8 h-topbar border-b border-border bg-shell/90 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] min-w-0">
          <span className="data-text text-text-secondary truncate">{plan.project_id}</span>
          {invalidated.length > 0 && justInvalidated && (
            <span className="label-micro text-warning-strong whitespace-nowrap">
              {invalidated.length} task{invalidated.length > 1 ? "s" : ""} invalidated
            </span>
          )}
        </div>
        <div className="mx-auto">
          <div className="segmented" role="tablist" aria-label="Project stage">
            {STAGES.map((s, i) => {
              const isCurrent = s.id === stage;
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={isCurrent}
                  data-active={isCurrent ? "true" : "false"}
                  onClick={() => setStage(s.id)}
                  disabled={i > stageIndex}
                  className={`${i > stageIndex ? "opacity-40 cursor-default" : ""}`}
                >
                  <span className={`mr-1.5 ${isCurrent ? "text-accent-strong" : ""}`}>0{i + 1}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInspectorOpen((o) => !o)}
            aria-label={inspectorOpen ? "Hide assistant" : "Show assistant"}
            className={`icon-button ${inspectorOpen ? "bg-accent-soft text-accent-strong" : ""}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a5 5 0 0 1 5 5c0 2-1 3-2 4v2h-6v-2c-1-1-2-2-2-4a5 5 0 0 1 5-5z" />
              <path d="M9 18h6M10 21h4" />
            </svg>
          </button>
          <Button size="sm" variant="ghost" onClick={onReset}>
            <IconArrow size={13} className="rotate-180" /> New
          </Button>
        </div>
      </div>

      {/* honest status + error surface */}
      {(showError || pendingApprovals > 0 || budgetPause) && (
        <div className="sticky top-topbar z-10 px-5 sm:px-8 py-2 bg-shell border-b border-border">
          {showError && (
            <p className="text-[12.5px] text-error-strong">
              {error}
            </p>
          )}
          {pendingApprovals > 0 && (
            <div className="flex items-center justify-between gap-4 py-1">
              <p className="text-[12.5px] text-warning-strong">
                Build paused — {pendingApprovals} action{pendingApprovals > 1 ? "s" : ""} need your approval.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  // approve all pending — they are user-facing gates
                  const list = await import("@/lib/api").then((m) => m.api.approvals(plan.project_id));
                  for (const a of list) await onResolveApproval(a.id, "approve");
                }}
              >
                Approve all
              </Button>
            </div>
          )}
          {budgetPause && (
            <div className="flex flex-wrap items-center justify-between gap-3 py-1.5">
              <div className="text-[12.5px] text-warning-strong">
                <p className="font-medium">Usage limit reached</p>
                <p className="text-text-secondary font-normal mt-0.5">
                  {budgetPause.mode} limit {budgetPause.limit} · used {budgetPause.used.toFixed(2)} · remaining{" "}
                  {budgetPause.remaining.toFixed(2)} · waiting on task{" "}
                  <span className="data-text">{budgetPause.task_id}</span>
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => onResolveBudget("stop")}>
                  Stop
                </Button>
                <Button size="sm" onClick={() => onResolveBudget("continue")}>
                  Continue
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stage content */}
      <div className="relative z-10 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {stage === "plan" && (
              <PlanningView
                plan={plan}
                onEditTechChoice={onEditTechChoice}
                onApprove={handleApprove}
                busy={busy === "approve"}
                onSelectSection={selectSection}
                section={selection.kind === "section" ? selection.id ?? "" : ""}
              />
            )}
            {stage === "build" && (
              <ExecutionView
                plan={plan}
                busy={busy === "execute"}
                onExecute={handleExecuteFromBuild}
                onReview={() => setStage("review")}
              />
            )}
            {stage === "review" && (
              <ReviewView plan={plan} busy={busy === "continue"} onContinue={handleContinue} />
            )}
            {stage === "delivery" && <DeliveryView plan={plan} onReset={onReset} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress — quiet, soft */}
      <div className="sticky bottom-0 px-5 sm:px-8 py-3 bg-shell/90 backdrop-blur-sm border-t border-border">
        <div className="flex items-center gap-3">
          <div className="progress-track flex-1 max-w-xs">
            <div className="progress-fill" style={{ width: `${((stageIndex + 1) / 4) * 100}%` }} />
          </div>
          <span className="label-micro !text-text-secondary">
            Stage 0{stageIndex + 1} of 04
          </span>
        </div>
      </div>

      {/* Floating glass inspector — contextual, never dominant */}
      <AnimatePresence>
        {inspectorOpen && (
          <motion.div
            initial={{ opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-6 top-20 bottom-16 w-[340px] z-30"
          >
            <div className="glass h-full overflow-hidden">
              <ContextInspector
                plan={plan}
                selection={selection}
                onClose={() => setSelection({ kind: "none" })}
                onApprove={handleApprove}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {inspectorOpen && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="sm:hidden fixed inset-x-0 bottom-0 z-40 max-h-[70vh] pb-16"
          >
            <div className="absolute inset-0 bg-black/30" onClick={() => setInspectorOpen(false)} aria-hidden="true" />
            <div className="relative h-full rounded-t-panel bg-shell border-t border-border shadow-soft overflow-hidden">
              <div className="h-1 w-10 bg-border-strong rounded-full mx-auto mt-2.5" aria-hidden="true" />
              <div className="h-[calc(70vh-64px)] overflow-y-auto">
                <ContextInspector
                  plan={plan}
                  selection={selection}
                  onClose={() => setSelection({ kind: "none" })}
                  onApprove={handleApprove}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}