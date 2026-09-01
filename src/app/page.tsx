"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePlan } from "@/hooks/usePlan";
import { AppShell } from "@/components/layout/AppShell";
import { HomeView } from "@/components/home/HomeView";
import { WorkspaceView } from "@/components/workspace/WorkspaceView";
import { SettingsView } from "@/components/settings/SettingsView";
import { ProjectsView } from "@/components/projects/ProjectsView";
import { api, type ProjectSummary } from "@/lib/api";
import type { NavView } from "@/components/layout/Sidebar";

export default function HomePage() {
  const {
    plan,
    projectStatus,
    isGenerating,
    error,
    invalidated,
    pendingApprovals,
    budgetPause,
    resolveBudgetPause,
    createPlanFromGoal,
    loadProject,
    editTechChoice,
    approvePlan,
    executePlan,
    completePlan,
    resolveApproval,
    resetPlan,
  } = usePlan();

  const [view, setView] = useState<NavView>("home");
  const [workingOn, setWorkingOn] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    try {
      setProjects(await api.listProjects());
      setProjectsError(null);
    } catch (err) {
      setProjectsError(err instanceof Error ? err.message : "Failed to load projects");
    }
  }, []);

  useEffect(() => {
    if (view === "projects") void refreshProjects();
  }, [view, refreshProjects]);

  const startWork = useCallback(
    async (goal: string, context?: string) => {
      setWorkingOn(goal);
      try {
        await createPlanFromGoal(goal, context);
        setView("projects");
      } catch {
        /* error surfaced through the hook */
      } finally {
        setWorkingOn(null);
      }
    },
    [createPlanFromGoal]
  );

  const openProject = useCallback(
    async (projectId: string) => {
      try {
        await loadProject(projectId);
        setView("projects");
      } catch {
        /* error surfaced through the hook */
      }
    },
    [loadProject]
  );

  const reset = useCallback(() => {
    resetPlan();
    setView("home");
  }, [resetPlan]);

  return (
    <AppShell current={view} onNavigate={setView} rightRail={null}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
        >
          {view === "home" ? (
            <HomeView
              onBegin={startWork}
              isLoading={isGenerating || workingOn !== null}
              hasProject={!!plan}
              onOpenProject={() => setView("projects")}
            />
          ) : view === "projects" ? (
            plan ? (
              <WorkspaceView
                plan={plan}
                status={projectStatus ?? "planning"}
                invalidated={invalidated}
                pendingApprovals={pendingApprovals}
                budgetPause={budgetPause}
                onResolveBudget={resolveBudgetPause}
                error={error}
                onEditTechChoice={editTechChoice}
                onApprove={approvePlan}
                onExecute={executePlan}
                onContinue={completePlan}
                onResolveApproval={resolveApproval}
                onReset={reset}
              />
            ) : (
              <ProjectsView
                projects={projects}
                error={projectsError}
                onOpenProject={openProject}
                onRefresh={refreshProjects}
              />
            )
          ) : view === "settings" ? (
            <SettingsView />
          ) : (
            <div className="grid place-items-center min-h-[60vh] px-6">
              <div className="text-center max-w-sm">
                <p className="display text-display-md mb-3">Projects</p>
                <p className="text-[13px] text-text-secondary">
                  Your builds live here. Start one from the home composer —
                  everything is planned before anything is built.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}