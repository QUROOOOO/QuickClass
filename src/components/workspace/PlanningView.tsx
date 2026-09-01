"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Plan, TechChoice, DecisionSource } from "@/types/plan";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { IconChevron } from "@/components/ui/Icon";
import { DependencyCascade } from "./DependencyCascade";
import { TaskGraph } from "./TaskGraph";

interface PlanningViewProps {
  plan: Plan;
  onEditTechChoice: (
    name: string,
    status: TechChoice["status"],
    source: DecisionSource,
    replacement?: string
  ) => Promise<unknown> | void;
  onApprove: () => void;
  busy?: boolean;
  onSelectSection: (section: string) => void;
  section: string;
}

interface CascadeState {
  techName: string;
  oldValue: string;
  newValue: string;
  affectedSections: string[];
  affectedTasks: string[];
}

const STAGES = [
  { id: "requirements", label: "Understanding", index: "01" },
  { id: "architecture", label: "Architecture", index: "02" },
  { id: "tech_stack", label: "Technology", index: "03" },
  { id: "milestones", label: "Milestones", index: "04" },
  { id: "tasks", label: "Task Graph", index: "05" },
];

export function PlanningView({ plan, onEditTechChoice, onApprove, busy, onSelectSection, section }: PlanningViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["requirements", "architecture", "tech_stack", "milestones", "tasks"])
  );
  const [cascade, setCascade] = useState<CascadeState | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTechChange = async (
    name: string,
    status: TechChoice["status"],
    source: DecisionSource,
    replacement?: string
  ) => {
    const old = plan.tech_choices.find((tc) => tc.name === name);
    if (replacement && replacement.trim() && replacement.trim() !== name) {
      await onEditTechChoice(name, status, source, replacement.trim());
    }
    if (old && old.status !== status) {
      const tasks = plan.tasks.filter((t) => t.status === "pending").map((t) => t.title);
      setCascade({
        techName: name,
        oldValue: old.status,
        newValue: status,
        affectedSections: ["architecture", "requirements", "milestones"],
        affectedTasks: tasks.slice(0, 5),
      });
      setTimeout(() => setCascade(null), 6500);
    }
  };

  const ready = expanded.size >= 5;

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8 lg:py-12">
      {/* stage index */}
      <div className="mb-10">
        <p className="label-micro text-text-secondary mb-4">Live blueprint · rev {plan.plan_version || plan.version}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {STAGES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onSelectSection(s.id)}
              className={`flex items-center gap-2 text-[11px] transition-colors
                ${expanded.has(s.id) ? "text-text-secondary" : "text-text-faint"}`}
            >
              <span className="data-text">{s.index}</span>
              <span className="label-caps">{s.label}</span>
              {i < STAGES.length - 1 && <span className="hidden sm:block w-4 h-px bg-border-active ml-1" />}
            </button>
          ))}
        </div>
      </div>

      {/* goal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10"
      >
        <h1 className="display text-display-md sm:text-display-lg">{plan.goal}</h1>
        {plan.description && (
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-text-secondary">{plan.description}</p>
        )}
      </motion.div>

      {/* cascade */}
      <AnimatePresence>
        {cascade && <DependencyCascade data={cascade} />}
      </AnimatePresence>

      {/* sections */}
      <div className="space-y-3">
        <Section
          id="requirements"
          index="01"
          label="Understanding"
          count={`${plan.requirements.length} deliverables`}
          expanded={expanded.has("requirements")}
          onToggle={() => toggle("requirements")}
        >
          <div className="space-y-2">
            {plan.requirements.map((r) => (
              <div key={r.id} className="flex items-start gap-3 px-4 py-2.5 rounded-lg bg-surface-secondary/60">
                <StatusDot status={r.status === "approved" ? "done" : "pending"} />
                <p className="text-[13.5px] text-text-primary leading-relaxed flex-1">{r.text}</p>
                <Badge tone={r.category === "billing" ? "info" : r.category === "staff" ? "warning" : "neutral"}>
                  {r.category}
                </Badge>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="architecture"
          index="02"
          label="Architecture"
          count={`${plan.architecture_decisions.length} decisions`}
          expanded={expanded.has("architecture")}
          onToggle={() => toggle("architecture")}
        >
          <div className="space-y-2">
            {plan.architecture_decisions.map((d) => (
              <div key={d.id} className="px-4 py-3 rounded-lg bg-surface-secondary/60">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13.5px] font-medium text-text-primary">{d.decision}</p>
                  <Badge tone={d.recommended ? "success" : "neutral"}>{d.recommended ? "recommended" : "alternative"}</Badge>
                </div>
                <p className="text-[12px] text-text-secondary mt-1">{d.rationale}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="tech_stack"
          index="03"
          label="Technology"
          count={`${plan.tech_choices.length} choices`}
          expanded={expanded.has("tech_stack")}
          onToggle={() => toggle("tech_stack")}
        >
          <div className="grid sm:grid-cols-2 gap-2">
            {plan.tech_choices.map((tc) => (
              <TechChoiceCard
                key={`${tc.name}-${tc._index ?? 0}`}
                choice={tc}
                editing={editing === tc.name}
                onEdit={() => setEditing(editing === tc.name ? null : tc.name)}
                onChange={handleTechChange}
              />
            ))}
          </div>
        </Section>

        <Section
          id="milestones"
          index="04"
          label="Milestones"
          count={`${plan.milestones.length} milestones`}
          expanded={expanded.has("milestones")}
          onToggle={() => toggle("milestones")}
        >
          <div className="space-y-2">
            {plan.milestones.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-secondary/60">
                <StatusDot status={m.completed ? "done" : "pending"} />
                <div className="flex-1">
                  <p className="text-[13.5px] font-medium text-text-primary">{m.title}</p>
                  <p className="text-[12px] text-text-secondary">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="tasks"
          index="05"
          label="Task Graph"
          count={`${plan.tasks.length} tasks`}
          expanded={expanded.has("tasks")}
          onToggle={() => toggle("tasks")}
        >
          <TaskGraph tasks={plan.tasks} />
        </Section>
      </div>

      {/* ready state */}
      <AnimatePresence>
        {ready && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12"
          >
            <div className="card-raised p-8 flex flex-col items-center text-center">
              <div className="w-11 h-11 grid place-items-center rounded-full bg-accent-soft mb-4">
                <svg className="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="display text-display-xs mb-2">Blueprint ready.</h2>
              <p className="text-[13px] text-text-secondary max-w-sm mb-6">
                Every decision is yours. Change anything, watch the effect
                propagate, then approve the build.
              </p>
              <Button size="lg" onClick={onApprove} disabled={busy} className="rounded-xl">
                {busy ? "Submitting for review…" : "Approve & execute"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({
  id, index, label, count, expanded, onToggle, children,
}: {
  id: string; index: string; label: string; count: string;
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="card-surface overflow-hidden"
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none group"
      >
        <span className="data-text text-[10px] text-text-muted">{index}</span>
        <h2 className="text-[14px] font-semibold tracking-tight text-text-primary flex-1">{label}</h2>
        <span className="data-text text-[10px] text-text-faint hidden sm:inline">{count}</span>
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-text-muted"
        >
          <IconChevron size={14} />
        </motion.span>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TechChoiceCard({
  choice, editing, onEdit, onChange,
}: {
  choice: TechChoice;
  editing: boolean;
  onEdit: () => void;
  onChange: (
    name: string,
    status: TechChoice["status"],
    source: DecisionSource,
    replacement?: string
  ) => Promise<unknown> | void;
}) {
  return (
    <div className={`rounded-lg border transition-all duration-200
      ${editing ? "border-accent/40 bg-accent-soft/40 shadow-sm" : "border-border bg-surface-secondary/60 hover:border-border-active"}`}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13.5px] font-medium text-text-primary">{choice.name}</p>
          <button
            onClick={onEdit}
            aria-label={`Change ${choice.name}`}
            className="text-[11px] font-medium text-text-muted hover:text-accent transition-colors px-1.5 py-0.5"
          >
            {editing ? "Close" : "Change"}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="label-caps text-text-muted">{choice.category}</span>
          <Badge tone={choice.status === "selected" ? "success" : choice.status === "rejected" ? "error" : choice.status === "superseded" ? "warning" : "neutral"}>
            {choice.status}
          </Badge>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-border/60">
              <p className="label-micro mb-2">Replace this choice</p>
              <div className="flex gap-2">
                <input
                  defaultValue={choice.name}
                  key={`input-${choice._index ?? 0}`}
                  aria-label={`Replacement for ${choice.name}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const target = e.currentTarget.value;
                      void onChange(choice.name, "selected", "user", target);
                      onEdit();
                    }
                  }}
                  className="flex-1 min-w-0 rounded-lg bg-surface-primary border border-border px-3 py-1.5 text-[13px] text-text-primary focus:outline-none focus:border-border-active"
                />
                <Button size="sm" onClick={(e) => {
                  const input = (e.currentTarget.closest("div")?.querySelector("input")) as HTMLInputElement | null;
                  void onChange(choice.name, "selected", "user", input?.value ?? choice.name);
                  onEdit();
                }}>
                  Update
                </Button>
              </div>
              <p className="text-[11.5px] text-text-secondary mt-2">
                Changing the choice creates a new plan version and invalidates
                dependent tasks.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
