"use client";

import { motion, AnimatePresence } from "motion/react";
import type { Plan } from "@/types/plan";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { IconSpark, IconClose } from "@/components/ui/Icon";

type Selection = {
  kind: "section" | "task" | "decision" | "none";
  id?: string;
  label?: string;
};

interface ContextInspectorProps {
  plan: Plan;
  selection: Selection;
  onClose: () => void;
  onApprove: () => void;
}

/**
 * CONTEXTUAL INSPECTOR — glass, transforms with context.
 * No selection → AI assistant / project summary.
 * Selection → task details, dependency route, or decision editor.
 * Always readable; never the visual anchor.
 */
export function ContextInspector({ plan, selection, onClose, onApprove }: ContextInspectorProps) {
  return (
    <div className="flex flex-col h-full p-3">
      <GlassPanel strong className="flex-1 flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-glass-border">
          <span className="label-micro text-text-muted">
            {selection.kind === "none" ? "Assistant" : "Inspector"}
          </span>
          {selection.kind !== "none" && (
            <button
              onClick={onClose}
              aria-label="Clear selection"
              className="w-7 h-7 grid place-items-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-tertiary/70 transition-colors"
            >
              <IconClose size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {selection.kind === "none" ? (
            <AssistantView plan={plan} />
          ) : selection.kind === "task" ? (
            <TaskView plan={plan} taskId={selection.id} />
          ) : selection.kind === "decision" ? (
            <DecisionView plan={plan} name={selection.label} />
          ) : (
            <SectionView plan={plan} section={selection.id} />
          )}
        </div>

        {/* footer action */}
        <div className="px-4 py-3 border-t border-glass-border">
          <Button fullWidth size="md" onClick={onApprove}>
            Approve & execute
          </Button>
        </div>
      </GlassPanel>
    </div>
  );
}

function AssistantView({ plan }: { plan: Plan }) {
  const tasksDone = plan.tasks.filter((t) => t.status === "done").length;
  const tasksTotal = plan.tasks.length;
  return (
    <div className="space-y-5">
      <div>
        <p className="label-micro text-text-secondary mb-2">Project summary</p>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          {plan.description || plan.goal}
        </p>
      </div>

      <div className="space-y-2">
        <Row label="Requirements" value={`${plan.requirements.length}`} />
        <Row label="Decisions" value={`${plan.architecture_decisions.length}`} />
        <Row label="Stack items" value={`${plan.tech_choices.length}`} />
        <Row label="Milestones" value={`${plan.milestones.length}`} />
        <Row label="Tasks" value={`${tasksDone}/${tasksTotal} done`} />
      </div>

      <div className="pt-3 border-t border-glass-border">
        <p className="label-micro mb-2 flex items-center gap-1.5">
          <IconSpark size={12} className="text-accent" />
          Next step
        </p>
        <p className="text-[12.5px] text-text-secondary leading-relaxed">
          Review the draft. Select any section to inspect rationale and
          dependencies, then approve to start building.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span className="text-text-muted">{label}</span>
      <span className="data-text text-text-primary">{value}</span>
    </div>
  );
}

function TaskView({ plan, taskId }: { plan: Plan; taskId?: string }) {
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task) return <p className="text-[13px] text-text-secondary">Task not found.</p>;
  const deps = task.dependencies.map((id) => plan.tasks.find((t) => t.id === id)?.title ?? id);
  return (
    <div className="space-y-5">
      <div>
        <Badge tone={task.status === "done" ? "success" : task.status === "running" ? "accent" : task.status === "blocked" ? "error" : "neutral"} dot>
          {task.status}
        </Badge>
        <h3 className="text-[15px] font-semibold mt-2 leading-snug">{task.title}</h3>
        <p className="text-[12.5px] text-text-secondary mt-1.5">{task.description}</p>
      </div>

      <div className="space-y-1.5">
        <p className="label-micro">Waits on</p>
        {deps.length ? (
          deps.map((d) => <p key={d} className="text-[12.5px] text-text-secondary">→ {d}</p>)
        ) : (
          <p className="text-[12.5px] text-text-faint">Nothing — can start immediately</p>
        )}
      </div>

      <div className="space-y-1.5 pt-2 border-t border-glass-border">
        <p className="label-micro">Estimate</p>
        <p className="text-[12.5px] text-text-secondary data-text">
          {task.estimated_hours}h planned · {task.actual_hours}h spent
        </p>
      </div>
    </div>
  );
}

function DecisionView({ plan, name }: { plan: Plan; name?: string }) {
  const choice = plan.tech_choices.find((c) => c.name === name);
  if (!choice) return <p className="text-[13px] text-text-secondary">Decision not found.</p>;
  return (
    <div className="space-y-5">
      <div>
        <p className="label-micro text-text-secondary mb-2">Decision</p>
        <h3 className="text-[15px] font-semibold leading-snug">{choice.name}</h3>
        <Badge tone={choice.status === "selected" ? "success" : choice.status === "rejected" ? "error" : "neutral"} dot>
          {choice.status}
        </Badge>
      </div>
      <div>
        <p className="label-micro mb-1.5">Rationale</p>
        <p className="text-[12.5px] text-text-secondary leading-relaxed">{choice.rationale}</p>
      </div>
      <div className="pt-2 border-t border-glass-border">
        <p className="label-micro mb-1.5">Category</p>
        <p className="text-[12.5px] text-text-secondary">{choice.category}</p>
      </div>
    </div>
  );
}

function SectionView({ plan, section }: { plan: Plan; section?: string }) {
  const counts: Record<string, { label: string; value: string }> = {
    requirements: { label: "Requirements", value: `${plan.requirements.length} deliverables` },
    architecture: { label: "Architecture", value: `${plan.architecture_decisions.length} decisions` },
    tech_stack: { label: "Technology", value: `${plan.tech_choices.length} choices` },
    milestones: { label: "Milestones", value: `${plan.milestones.length} milestones` },
    tasks: { label: "Task Graph", value: `${plan.tasks.length} tasks` },
  };
  const info = counts[section ?? ""] ?? counts.requirements;
  return (
    <div className="space-y-5">
      <div>
        <p className="label-micro text-text-secondary mb-1.5">{info.label}</p>
        <p className="text-[13px] text-text-secondary">{info.value}</p>
      </div>
      <div className="pt-3 border-t border-glass-border">
        <p className="label-micro mb-2">Blueprint path</p>
        <p className="text-[12.5px] text-text-secondary leading-relaxed">
          Select this section in the project navigation to inspect its contents,
          or select individual tasks and decisions to see their dependencies.
        </p>
      </div>
    </div>
  );
}
