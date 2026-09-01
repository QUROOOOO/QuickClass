import { useState, useEffect, useCallback, useRef } from "react";
import type { Plan, TechChoice, DecisionSource } from "@/types/plan";
import { api, connectEvents, mapPlan, type BudgetPauseRecord } from "@/lib/api";

/**
 * usePlan — live project state.
 *
 * Every transition hits the real backend: goal → project → plan →
 * tech edits (new version + invalidation) → submit → approve →
 * execute → complete. SSE keeps the view in sync with typed events.
 */
export function usePlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidated, setInvalidated] = useState<string[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<number>(0);
  const [budgetPause, setBudgetPause] = useState<BudgetPauseRecord | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const projectIdRef = useRef<string | null>(null);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsConnected(false);
  }, []);

  const refreshApprovals = useCallback(async (projectId: string) => {
    try {
      const list = await api.approvals(projectId);
      setPendingApprovals(list.length);
    } catch {
      setPendingApprovals(0);
    }
  }, []);

  const refreshBudgetPause = useCallback(async (projectId: string) => {
    try {
      setBudgetPause(await api.getBudgetPause(projectId));
    } catch {
      setBudgetPause(null);
    }
  }, []);

  const refreshPlan = useCallback(
    async (projectId: string, status?: string) => {
      try {
        const [raw, project] = await Promise.all([
          api.getPlan(projectId),
          status ? Promise.resolve(null) : api.listProjects().then((l) => l.find((p) => p.id === projectId) ?? null),
        ]);
        const nextStatus = status ?? project?.status ?? "planning";
        setProjectStatus(nextStatus);
        setPlan(mapPlan(projectId, raw, nextStatus));
        if (nextStatus === "blocked") refreshApprovals(projectId);
        if (nextStatus === "budget_paused") refreshBudgetPause(projectId);
        else setBudgetPause(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load plan");
      }
    },
    [refreshApprovals, refreshBudgetPause]
  );

  const connectSSE = useCallback(
    (projectId: string) => {
      disconnect();
      const controller = new AbortController();
      abortRef.current = controller;
      void connectEvents(projectId, (type, payload) => {
        setLastEvent(type);
        if (type === "project.state_changed") {
          setProjectStatus(String(payload.current ?? "planning"));
        }
        if (type === "plan.version_created" || type === "plan.edited" || type === "plan.dependency_invalidated") {
          setInvalidated(Array.isArray(payload.invalidated_task_ids) ? (payload.invalidated_task_ids as string[]) : []);
          void refreshPlan(projectId);
        }
        if (type === "approval.requested") refreshApprovals(projectId);
        if (type === "approval.resolved") refreshApprovals(projectId);
        if (type === "budget.limit_reached") refreshBudgetPause(projectId);
        if (type === "budget.resumed" || type === "budget.stopped") {
          setBudgetPause(null);
          void refreshPlan(projectId);
        }
        if (type === "plan.submitted" || type === "plan.approved" || type === "plan.rejected") {
          void refreshPlan(projectId);
        }
        if (type === "execution.started" || type === "task.completed" || type === "project.completed" || type === "project.failed") {
          void refreshPlan(projectId);
        }
      }, controller.signal);
      setIsConnected(true);
    },
    [disconnect, refreshApprovals, refreshPlan]
  );

  const createPlanFromGoal = useCallback(
    async (goal: string, context?: string) => {
      setIsGenerating(true);
      setError(null);
      setInvalidated([]);
      try {
        const project = await api.createProject(goal.slice(0, 60) || "New build");
        const pid = project.id;
        projectIdRef.current = pid;
        await api.startPlanning(pid, goal, context ?? "");
        await api.createPlan(pid, goal, context ?? "");
        await refreshPlan(pid);
        connectSSE(pid);
        return pid;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start the build");
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    [connectSSE, refreshPlan]
  );

  const loadProject = useCallback(
    async (projectId: string) => {
      setError(null);
      projectIdRef.current = projectId;
      await refreshPlan(projectId);
      connectSSE(projectId);
    },
    [connectSSE, refreshPlan]
  );

  const editTechChoice = useCallback(
    async (name: string, _status: TechChoice["status"], _source: DecisionSource, replacement?: string) => {
      if (!plan || !projectIdRef.current) return;
      const pid = projectIdRef.current;
      const current = plan.tech_choices.find((t) => t.name === name);
      if (!current) return;
      const next = replacement && replacement.trim() ? replacement.trim() : current.name;
      try {
        const result = await api.editTech(pid, current.category, next, "edited by the human");
        setInvalidated(result.invalidated_task_ids ?? []);
        await refreshPlan(pid);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update the decision");
        throw err;
      }
    },
    [plan, refreshPlan]
  );

  const approvePlan = useCallback(async () => {
    if (!projectIdRef.current) return;
    const pid = projectIdRef.current;
    setError(null);
    try {
      await api.submitPlan(pid);
      await api.reviewPlan(pid, "approve");
      await refreshPlan(pid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
      throw err;
    }
  }, [refreshPlan]);

  const executePlan = useCallback(async () => {
    if (!projectIdRef.current) return;
    const pid = projectIdRef.current;
    setError(null);
    try {
      const project = await api.execute(pid);
      setProjectStatus(project.status);
      await refreshPlan(pid, project.status);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Execution failed";
      setError(message);
      if (message.toLowerCase().includes("approval")) {
        await refreshApprovals(pid);
        await refreshPlan(pid);
      }
      throw err;
    }
  }, [refreshApprovals, refreshPlan]);

  const completePlan = useCallback(async () => {
    if (!projectIdRef.current) return;
    const pid = projectIdRef.current;
    try {
      const project = await api.complete(pid);
      setProjectStatus(project.status);
      await refreshPlan(pid, project.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Completion failed");
      throw err;
    }
  }, [refreshPlan]);

  const resolveApproval = useCallback(
    async (approvalId: string, decision: "approve" | "deny") => {
      if (!projectIdRef.current) return;
      const pid = projectIdRef.current;
      try {
        await api.resolveApproval(pid, approvalId, decision);
        await refreshApprovals(pid);
        if (decision === "approve") {
          await api.execute(pid);
          await refreshPlan(pid);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Approval update failed");
      }
    },
    [refreshApprovals, refreshPlan]
  );

  const resolveBudgetPause = useCallback(
    async (decision: "continue" | "stop") => {
      if (!projectIdRef.current) return;
      const pid = projectIdRef.current;
      try {
        await api.resumeBudget(pid, decision);
        setBudgetPause(null);
        if (decision === "continue") {
          await api.execute(pid);
        }
        await refreshPlan(pid);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to resolve the usage-limit pause");
      }
    },
    [refreshPlan]
  );

  const resetPlan = useCallback(() => {
    disconnect();
    setPlan(null);
    setProjectStatus(null);
    setError(null);
    setInvalidated([]);
    setPendingApprovals(0);
    setBudgetPause(null);
    projectIdRef.current = null;
  }, [disconnect]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    plan,
    projectStatus,
    isConnected,
    isGenerating,
    error,
    invalidated,
    pendingApprovals,
    budgetPause,
    lastEvent,
    createPlanFromGoal,
    loadProject,
    editTechChoice,
    approvePlan,
    executePlan,
    completePlan,
    resolveApproval,
    resolveBudgetPause,
    resetPlan,
  };
}