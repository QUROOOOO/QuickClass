/**
 * CODE BUTLER API CLIENT — the single surface for backend calls.
 *
 * Talks to the FastAPI backend (FastAPI; Firebase-ready). Tokens come
 * from the auth session (cb-session). Nothing here ever fabricates
 * data — if the backend is down, the UI shows an honest error.
 */
import type {
  Plan,
  PlanStatus,
  TechChoice,
  DecisionSource,
  Requirement,
  ArchitectureDecision,
  Milestone,
  Task,
} from "@/types/plan";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

function token(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("cb-session");
    if (!saved) return null;
    return (JSON.parse(saved) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = (body as { detail?: unknown }).detail;
    const message =
      typeof detail === "string"
        ? detail
        : (detail as { message?: string } | undefined)?.message ??
          `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/* SSE — the backend exposes a POST stream; EventSource is GET-only,   */
/* so we read the fetch body manually and dispatch named events.       */
/* ------------------------------------------------------------------ */

export type SseHandler = (eventType: string, payload: Record<string, unknown>) => void;

export async function connectEvents(
  projectId: string | null,
  onEvent: SseHandler,
  signal: AbortSignal
): Promise<void> {
  try {
    const res = await fetch(`${BASE}/api/v1/events/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, types: null }),
      signal,
    });
    if (!res.ok || !res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let pendingType = "message";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let type = pendingType;
        let data = "";
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event: ")) type = line.slice(7).trim();
          else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (data) {
          try {
            onEvent(type, JSON.parse(data));
          } catch {
            /* malformed frame — ignore */
          }
        }
      }
    }
  } catch {
    /* aborted or unreachable — caller decides whether to retry */
  }
}

/* ------------------------------------------------------------------ */
/* Mapping — backend entities → the Plan shape the UI already renders  */
/* ------------------------------------------------------------------ */

interface RawTechDecision {
  id: string;
  category: string;
  choice: string;
  status: string;
  reason: string;
  superseded_by: string | null;
}

interface RawTask {
  id: string;
  title: string;
  description: string;
  status: string;
  depends_on: string[];
  agent: string;
  evidence: string[];
}

interface RawPlan {
  version: number;
  goal: string;
  context: string;
  requirements: { id: string; statement: string; verified: boolean }[];
  architecture: { id: string; title: string; rationale: string; status: string }[];
  technology: RawTechDecision[];
  milestones: { id: string; title: string; description: string; completed: boolean }[];
  tasks: RawTask[];
  reason: string;
  created_at: number;
  parent_version: number | null;
}

function toTechChoice(t: RawTechDecision, index: number): TechChoice {
  const status = t.status === "selected" ? "selected" : t.status === "proposed" ? "proposed" : t.status === "superseded" ? "superseded" : "rejected";
  return {
    name: t.choice,
    category: t.category,
    version: "",
    status,
    rationale: t.reason || (t.status === "superseded" ? "Superseded by a newer decision." : ""),
    source: (t.reason ? "user" : "ai") as DecisionSource,
    _supersededBy: t.superseded_by,
    _index: index,
  };
}

export function mapPlan(projectId: string, raw: RawPlan, status: string): Plan {
  const requirements: Requirement[] = raw.requirements.map((r) => ({
    id: r.id,
    text: r.statement,
    priority: 1,
    category: "",
    status: r.verified ? "verified" : "pending",
  }));
  const architecture: ArchitectureDecision[] = raw.architecture.map((a) => ({
    id: a.id,
    decision: a.title,
    rationale: a.rationale,
    category: "",
    tech_stack: "",
    recommended: a.status === "recommended",
    status: a.status,
  }));
  const tech_choices: TechChoice[] = raw.technology.map(toTechChoice);
  const milestones: Milestone[] = raw.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    target_date: "",
    completed: m.completed,
    status: m.completed ? "completed" : "pending",
  }));
  const tasks: Task[] = raw.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: (t.status === "done" ? "done" : t.status === "running" ? "running" : t.status === "blocked" ? "blocked" : "pending") as Task["status"],
    priority: 0,
    dependencies: t.depends_on,
    block_list: [],
    agent_type: t.agent,
    estimated_hours: 0,
    actual_hours: 0,
  }));
  return {
    plan_id: projectId,
    project_id: projectId,
    goal: raw.goal,
    description: raw.context,
    version: raw.version,
    plan_version: raw.version,
    state: (status === "completed" ? "completed" : status === "failed" ? "failed" : status === "executing" || status === "approved" ? "executing" : "planning") as PlanStatus,
    requirements,
    architecture_decisions: architecture,
    tech_choices,
    milestones,
    tasks,
    created_at: new Date(raw.created_at * 1000).toISOString(),
    updated_at: new Date(raw.created_at * 1000).toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export const api = {
  createProject: (title: string) =>
    apiFetch<ProjectSummary>("/projects", { method: "POST", body: JSON.stringify({ title }) }),

  listProjects: () => apiFetch<ProjectSummary[]>("/projects"),

  startPlanning: (projectId: string, goal: string, context: string) =>
    apiFetch<ProjectSummary>(`/projects/${projectId}/planning`, {
      method: "POST",
      body: JSON.stringify({ goal, context }),
    }),

  createPlan: (projectId: string, goal: string, context: string) =>
    apiFetch<RawPlan>("/plans", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, goal, context }),
    }),

  getPlan: (projectId: string) => apiFetch<RawPlan>(`/plans/${projectId}`),

  editTech: (projectId: string, category: string, choice: string, reason: string) =>
    apiFetch<{ version: number; reason: string; technology: RawTechDecision[]; invalidated_task_ids: string[] }>(
      `/plans/${projectId}/tech`,
      { method: "POST", body: JSON.stringify({ category, choice, reason }) }
    ),

  submitPlan: (projectId: string) =>
    apiFetch<ProjectSummary>(`/projects/${projectId}/submit`, { method: "POST" }),

  reviewPlan: (projectId: string, decision: "approve" | "reject", reason = "") =>
    apiFetch<ProjectSummary>(`/projects/${projectId}/review?decision=${decision}&reason=${encodeURIComponent(reason)}`, {
      method: "POST",
    }),

  execute: (projectId: string) =>
    apiFetch<ProjectSummary>(`/projects/${projectId}/execute`, { method: "POST" }),

  complete: (projectId: string) =>
    apiFetch<ProjectSummary>(`/projects/${projectId}/complete`, { method: "POST" }),

  approvals: (projectId: string) =>
    apiFetch<{ id: string; kind: string; subject: string; detail: string; status: string }[]>(
      `/executions/${projectId}/approvals`
    ),

  resolveApproval: (projectId: string, approvalId: string, decision: "approve" | "deny") =>
    apiFetch(`/executions/${projectId}/approvals/${approvalId}?decision=${decision}`, { method: "POST" }),

  runs: (projectId: string) => apiFetch<Record<string, unknown>[]>(`/executions/${projectId}/runs`),

  artifacts: (projectId: string) => apiFetch<Record<string, unknown>[]>(`/executions/${projectId}/artifacts`),

  // ---- API key management (server-side storage; raw key never returned) ----
  listApiKeys: () => apiFetch<ApiCredential[]>("/settings/api-keys"),

  saveApiKey: (provider: Provider, api_key: string, label = "") =>
    apiFetch<ApiCredential>("/settings/api-keys", {
      method: "POST",
      body: JSON.stringify({ provider, api_key, label }),
    }),

  testApiKey: (credId: string) =>
    apiFetch<ApiCredential>(`/settings/api-keys/${credId}/test`, { method: "POST" }),

  removeApiKey: (credId: string) =>
    apiFetch<{ removed: boolean }>(`/settings/api-keys/${credId}`, { method: "DELETE" }),

  // ---- budget (usage-limit) configuration ----
  getBudget: (scopeId: string) => apiFetch<BudgetConfig>(`/settings/budget/${scopeId}`),

  setBudget: (scopeId: string, body: Partial<BudgetConfig>) =>
    apiFetch<BudgetConfig>(`/settings/budget/${scopeId}`, { method: "PUT", body: JSON.stringify(body) }),

  // ---- usage accounting (backend-authoritative) ----
  getUsage: (projectId: string) =>
    apiFetch<{ summary: UsageSummary; records: Record<string, unknown>[] }>(`/executions/${projectId}/usage`),

  // ---- budget pause / resume (execution pauses, never silently terminates) ----
  getBudgetPause: (projectId: string) =>
    apiFetch<BudgetPauseRecord | null>(`/executions/${projectId}/budget/pause`),

  resumeBudget: (projectId: string, decision: "continue" | "stop") =>
    apiFetch<ProjectSummary>(`/executions/${projectId}/budget/resume?decision=${decision}`, { method: "POST" }),

  // ---- Connected Tools (real connection state, real health checks) ----
  listTools: () => apiFetch<ToolWithConnection[]>("/tools"),
  getTool: (id: string) => apiFetch<ToolWithConnection>(`/tools/${id}`),
  connectTool: (id: string) => apiFetch<ToolWithConnection>(`/tools/${id}/connect`, { method: "POST" }),
  disconnectTool: (id: string) => apiFetch<ToolWithConnection>(`/tools/${id}/disconnect`, { method: "POST" }),
  enableTool: (id: string) => apiFetch<ToolWithConnection>(`/tools/${id}/enable`, { method: "POST" }),
  disableTool: (id: string) => apiFetch<ToolWithConnection>(`/tools/${id}/disable`, { method: "POST" }),
  testTool: (id: string) => apiFetch<ToolWithConnection>(`/tools/${id}/test`, { method: "POST" }),
  toolAudit: (id: string) => apiFetch<Record<string, unknown>[]>(`/tools/${id}/audit`),
};

export type ToolStatus = "connected" | "disconnected" | "disabled" | "error" | "requires_authentication";
export type PermissionRisk = "low" | "medium" | "high" | "critical";

export interface ToolPermissionDef {
  name: string;
  risk: PermissionRisk;
  description: string;
}

export interface ToolConnection {
  tool_id: string;
  status: ToolStatus;
  enabled: boolean;
  connected_at: number | null;
  last_health_check: number | null;
  last_used: number | null;
  last_latency_ms: number | null;
  error: string;
}

export interface ToolWithConnection {
  id: string;
  name: string;
  description: string;
  type: string;
  capabilities: string[];
  permissions: ToolPermissionDef[];
  connection: ToolConnection;
}

export type Provider = "gemini" | "openai" | "anthropic" | "openrouter" | "custom";

export interface ApiCredential {
  id: string;
  provider: Provider;
  label: string;
  masked_key: string;
  status: "unverified" | "verified" | "invalid";
  created_at: number;
}

export type BudgetMode = "disabled" | "tokens" | "cost";
export type BudgetPeriod = "per_run" | "per_project" | "daily" | "monthly";

export interface BudgetConfig {
  project_id: string;
  mode: BudgetMode;
  limit_tokens: number | null;
  limit_cost: number | null;
  period: BudgetPeriod;
}

export interface UsageSummary {
  mode: BudgetMode;
  period: BudgetPeriod;
  limit: number;
  used: number;
  reserved: number;
  remaining: number | null;
}

export interface BudgetPauseRecord {
  id: string;
  project_id: string;
  execution_id: string;
  task_id: string;
  reason: string;
  limit: number;
  used: number;
  remaining: number;
  mode: BudgetMode;
  created_at: number;
  resolved: boolean;
}