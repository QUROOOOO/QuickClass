"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Task } from "@/types/plan";
import { StatusDot } from "@/components/ui/StatusDot";

interface TaskGraphProps {
  tasks: Task[];
}

const STATUS_ORDER: Record<string, number> = { done: 0, running: 1, pending: 2, blocked: 3 };

/**
 * BLUEPRINT / TASK GRAPH — spatial nodes, subtle 2.5D depth.
 * Selecting a node highlights its dependency route and softens
 * everything else. 2D layout with restrained shadows, not a 3D scene.
 */
export function TaskGraph({ tasks }: TaskGraphProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const selectedNode = selected ? byId.get(selected) : null;

  const depIds = new Set<string>();
  if (selectedNode) {
    selectedNode.dependencies.forEach((d) => depIds.add(d));
    tasks.forEach((t) => {
      if (t.dependencies.includes(selectedNode.id)) depIds.add(t.id);
    });
  }

  const sorted = [...tasks].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  return (
    <div className="p-2">
      <div className="grid sm:grid-cols-2 gap-2">
        {sorted.map((task) => {
          const isSelected = task.id === selected;
          const isRelated = selected && (depIds.has(task.id) || task.id === selected);
          const dimmed = selected && !isRelated;

          return (
            <motion.button
              key={task.id}
              onClick={() => setSelected(isSelected ? null : task.id)}
              animate={{
                opacity: dimmed ? 0.35 : 1,
                scale: isSelected ? 1.02 : 1,
                boxShadow: isSelected
                  ? "0 4px 16px rgba(0,0,0,0.08)"
                  : "0 1px 2px rgba(0,0,0,0.03)",
              }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              aria-pressed={isSelected}
              className={`text-left rounded-lg border p-4 transition-colors duration-200
                ${isSelected
                  ? "border-accent/50 bg-surface-primary"
                  : "border-border bg-surface-primary hover:border-border-active"}`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <StatusDot
                  status={task.status === "running" ? "running" : task.status === "blocked" ? "blocked" : task.status === "done" ? "done" : "pending"}
                  pulse={task.status === "running"}
                />
                <span className="data-text text-[10px] text-text-muted">{task.id}</span>
                <span className="ml-auto label-caps text-text-muted">{task.agent_type}</span>
              </div>
              <p className="text-[13.5px] font-medium text-text-primary leading-snug">{task.title}</p>
              <p className="text-[12px] text-text-secondary mt-0.5">{task.description}</p>

              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="label-micro mb-1.5">Dependencies</p>
                    {task.dependencies.length ? (
                      task.dependencies.map((d) => {
                        const dep = byId.get(d);
                        return (
                          <p key={d} className="text-[12px] text-text-secondary flex items-center gap-1.5">
                            <span className="text-text-faint">→</span>
                            {dep?.title ?? d}
                          </p>
                        );
                      })
                    ) : (
                      <p className="text-[12px] text-text-faint">None — can start immediately</p>
                    )}
                    {task.block_list.length > 0 && (
                      <p className="text-[11.5px] text-error mt-2">
                        Blocked by: {task.block_list.map((b) => byId.get(b)?.title ?? b).join(", ")}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
