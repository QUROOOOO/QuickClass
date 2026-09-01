"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { IconArrow } from "@/components/ui/Icon";
import type { ProjectSummary } from "@/lib/api";

interface ProjectsViewProps {
  projects: ProjectSummary[];
  error: string | null;
  onOpenProject: (projectId: string) => void;
  onRefresh: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  planning: "Planning",
  awaiting_review: "Awaiting review",
  approved: "Approved",
  executing: "Building",
  testing: "Testing",
  reviewing: "Reviewing",
  repairing: "Repairing",
  verified: "Verified",
  completed: "Completed",
  blocked: "Blocked",
  failed: "Failed",
};

export function ProjectsView({ projects, error, onOpenProject, onRefresh }: ProjectsViewProps) {
  const handleRefresh = useCallback(() => onRefresh(), [onRefresh]);

  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 pt-10 pb-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="label-caps text-text-secondary mb-1.5">Your builds</p>
          <h1 className="display text-display-lg">Projects</h1>
        </div>
        <Button size="sm" variant="ghost" onClick={handleRefresh}>
          <IconArrow size={13} className="rotate-90" /> Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-panel border border-error-soft bg-error-soft/60 px-4 py-3 text-[13px] text-error-strong">
          {error}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-panel border border-border bg-surface-primary px-6 py-10 text-center">
          <p className="data-text text-text-secondary mb-1">No projects yet.</p>
          <p className="text-[13px] text-text-secondary max-w-sm mx-auto">
            Start from the home composer — Code Butler plans before it builds,
            so you always know what is coming.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onOpenProject(p.id)}
                className="w-full text-left rounded-card border border-border bg-surface-primary hover:bg-surface-secondary transition-colors px-5 py-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[14px] text-text-primary truncate">{p.title}</p>
                    <p className="data-text text-text-secondary mt-0.5 truncate">{p.id}</p>
                  </div>
                  <span className="label-micro shrink-0">{STATUS_LABEL[p.status] ?? p.status}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}