"use client";

import { motion, AnimatePresence } from "motion/react";
import type { Plan } from "@/types/plan";

interface ContextInspectorProps {
  plan: Plan;
  selectedSection: string | null;
  onClose: () => void;
  onSelectSection: (section: string | null) => void;
}

const META: Record<string, { title: string; eyebrow: string }> = {
  requirements: { title: "Understanding", eyebrow: "01 · What we must deliver" },
  architecture: { title: "Architecture", eyebrow: "02 · How it holds together" },
  tech_stack: { title: "Technology", eyebrow: "03 · What it is built from" },
  milestones: { title: "Milestones", eyebrow: "04 · How progress is paced" },
  tasks: { title: "Task Graph", eyebrow: "05 · What gets done, in what order" },
};

/**
 * CONTEXTUAL INSPECTOR — not a permanent rail.
 * Desktop: slides in as a right-side panel.
 * Mobile: rises as a bottom sheet. The workspace stays dominant otherwise.
 */
export function ContextInspector({
  plan,
  selectedSection,
  onClose,
  onSelectSection,
}: ContextInspectorProps) {
  const meta = selectedSection ? META[selectedSection] : null;

  return (
    <AnimatePresence>
      {meta && selectedSection && (
        <motion.div
          role="dialog"
          aria-label={`${meta.title} details`}
          aria-modal="false"
          initial={{ opacity: 0, x: 32, y: 40 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 32, y: 40 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed z-30 flex flex-col bg-surface-0 border-border
            md:w-[320px] md:inset-y-0 md:right-0 md:border-l md:rounded-none
            inset-x-0 bottom-0 max-h-[70svh] md:max-h-none rounded-t-md border-t"
        >
          {/* Header */}
          <div className="px-5 pt-4 pb-4 border-b border-border shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-micro mb-1 text-accent-dark">{meta.eyebrow}</p>
                <h3 className="display-heading text-display-sm text-text-primary">{meta.title}</h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Close inspector"
                className="p-1.5 text-text-muted hover:text-text-primary rounded-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-6">
            <SectionSummary plan={plan} section={selectedSection} />

            <div className="pt-4 border-t border-border">
              <p className="label-micro mb-2">Blueprint path</p>
              <div className="space-y-0.5">
                {Object.entries(META).map(([id, m], i) => (
                  <button
                    key={id}
                    onClick={() => onSelectSection(id)}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 text-left text-[12.5px] rounded-sm transition-colors duration-150 ${
                      id === selectedSection
                        ? "bg-accent-muted text-accent-dark"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-1"
                    }`}
                  >
                    <span className="data-text text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                    {m.title}
                  </button>
                ))}
              </div>
            </div>

            {plan.state === "planning" && (
              <div className="pt-4 border-t border-border">
                <p className="label-micro mb-2">Actions</p>
                <button
                  onClick={onClose}
                  className="w-full px-3 py-2.5 text-[12.5px] font-medium text-canvas bg-accent rounded-sm transition-all duration-150 hover:bg-accent-dark active:scale-[0.98]"
                >
                  Approve & execute
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionSummary({ plan, section }: { plan: Plan; section: string }) {
  switch (section) {
    case "requirements":
      return <List label="Deliverables" items={plan.requirements.map((r) => r.text)} />;
    case "architecture":
      return <List label="Decisions" items={plan.architecture_decisions.map((d) => `${d.decision} — ${d.rationale}`)} />;
    case "tech_stack":
      return <List label="Stack" items={plan.tech_choices.map((t) => `${t.name} (${t.category})`)} />;
    case "milestones":
      return <List label="Milestones" items={plan.milestones.map((m) => `${m.title}${m.completed ? " · done" : ""}`)} />;
    case "tasks":
      return <List label="Tasks" items={plan.tasks.map((t) => `${t.title} · ${t.status}${t.dependencies.length ? ` · waits on ${t.dependencies.join(", ")}` : ""}`)} />;
    default:
      return null;
  }
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="label-micro mb-2">{label}</p>
      <ul className="space-y-2">
        {items.slice(0, 8).map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-text-secondary leading-relaxed">
            <span className="mt-1.5 w-1 h-1 rounded-full bg-accent/50 shrink-0" />
            {item}
          </li>
        ))}
        {items.length > 8 && <li className="text-[11px] text-text-faint">+ {items.length - 8} more</li>}
      </ul>
    </div>
  );
}
