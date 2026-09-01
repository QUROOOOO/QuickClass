"use client";

import { motion } from "motion/react";
import { IconArrow } from "@/components/ui/Icon";

interface CascadeData {
  techName: string;
  oldValue: string;
  newValue: string;
  affectedSections: string[];
  affectedTasks: string[];
}

const SECTION_LABELS: Record<string, string> = {
  architecture: "Architecture",
  requirements: "Requirements",
  milestones: "Milestones",
  tasks: "Tasks",
};

/**
 * DEPENDENCY CASCADE — Code Butler's signature interaction.
 * When a decision changes, this teaches the user the blast radius:
 * the changed node, the downstream decisions it invalidates, and
 * the tasks that must be re-planned. Staggered, causal, not decorative.
 */
export function DependencyCascade({ data }: { data: CascadeData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden mb-4"
    >
      <div className="card-raised overflow-hidden">
        {/* The change */}
        <div className="px-5 py-4 border-b border-border bg-accent-soft/30">
          <p className="label-micro text-text-secondary mb-1.5">Decision changed</p>
          <div className="flex items-center gap-2.5 text-[14px]">
            <span className="font-medium text-text-primary">{data.techName}</span>
            <span className="text-text-faint line-through">{data.oldValue}</span>
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="text-accent"
            >
              <IconArrow size={14} />
            </motion.span>
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35, duration: 0.3 }}
              className="font-semibold text-text-secondary"
            >
              {data.newValue}
            </motion.span>
          </div>
        </div>

        {/* Propagation */}
        <div className="px-5 py-4 space-y-3">
          <p className="label-micro text-text-muted">
            {data.affectedSections.length} sections affected · {data.affectedTasks.length} tasks need revision
          </p>

          <div className="space-y-0">
            {data.affectedSections.map((s, i) => (
              <div key={s}>
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface-secondary/70"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-[13px] text-text-primary font-medium">
                    {SECTION_LABELS[s] ?? s}
                  </span>
                  <span className="ml-auto text-[11px] text-text-muted">needs revision</span>
                </motion.div>
                {i < data.affectedSections.length - 1 && (
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.25 + i * 0.12, duration: 0.25 }}
                    className="w-px h-4 bg-accent/30 mx-4 origin-top"
                  />
                )}
              </div>
            ))}
          </div>

          {/* affected tasks */}
          {data.affectedTasks.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + data.affectedSections.length * 0.1, duration: 0.4 }}
              className="pt-2 border-t border-border"
            >
              <p className="label-micro mb-2">Re-planned tasks</p>
              <div className="flex flex-wrap gap-1.5">
                {data.affectedTasks.map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-md bg-surface-primary border border-border text-[11.5px] text-text-secondary">
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
