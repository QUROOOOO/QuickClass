export type PlanStatus = "planning" | "executing" | "reviewing" | "completed" | "failed";
export type TaskStatus = "pending" | "running" | "done" | "blocked";
export type DecisionSource = "ai" | "user" | "pending";

export interface Requirement {
  id: string;
  text: string;
  priority: number;
  category: string;
  status: string;
}

export interface ArchitectureDecision {
  id: string;
  decision: string;
  rationale: string;
  category: string;
  tech_stack: string;
  recommended: boolean;
  status: string;
}

export interface TechChoice {
  name: string;
  category: string;
  version: string;
  status: "selected" | "proposed" | "rejected" | "superseded";
  rationale: string;
  source: DecisionSource;
  _supersededBy?: string | null;
  _index?: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  target_date: string;
  completed: boolean;
  status: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  dependencies: string[];
  block_list: string[];
  agent_type: string;
  estimated_hours: number;
  actual_hours: number;
}

export interface PlanDiff {
  project_id: string;
  changed_fields: { field: string; old_count: number; new_count: number }[];
  affected_tasks: string[];
  affected_sections: string[];
  action: string;
  diff_json: Record<string, unknown>;
}

export interface Plan {
  plan_id: string;
  project_id: string;
  goal: string;
  description: string;
  version: number;
  state: PlanStatus;
  requirements: Requirement[];
  architecture_decisions: ArchitectureDecision[];
  tech_choices: TechChoice[];
  milestones: Milestone[];
  tasks: Task[];
  created_at: string;
  updated_at: string;
  plan_version: number;
}

export interface PlanEvent {
  type: string;
  data: Partial<Plan> | PlanDiff;
  event_id: string;
  timestamp: string;
}

export interface PlanSnapshot {
  type: "snapshot";
  data: Plan;
}
