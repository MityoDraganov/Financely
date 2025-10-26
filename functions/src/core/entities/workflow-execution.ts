import { Timestamp } from "firebase-admin/firestore";

/**
 * Workflow execution data models
 */

export type WorkflowStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type StepStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  active: boolean;
  latestVersion: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkflowVersion {
  workflowId: string;
  version: number;
  trigger: {
    type: string;
    config?: Record<string, unknown>;
  };
  steps: Record<string, StepDefinition>;
  edges: WorkflowEdge[];
  inputSchema?: Record<string, unknown>;
  createdAt: Timestamp;
}

export interface StepDefinition {
  id: string;
  type: string; // "http_request", "delay", "branch", etc.
  name?: string;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string; // Expression for conditional execution
}

export interface WorkflowRun {
  runId: string;
  workflowId: string;
  version: number;
  tenantId: string;
  status: WorkflowStatus;
  input: Record<string, unknown>;
  context: Record<string, unknown>; // Evolving key-value store for data between steps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  error?: {
    code?: string;
    message: string;
    details?: unknown;
  };
}

export interface StepExecution {
  stepId: string;
  type: string;
  status: StepStatus;
  attempt: number;
  rev: number; // Increment every write to guard replays
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  result?: Record<string, unknown>;
  error?: {
    code?: string;
    message: string;
    details?: unknown;
  };
  next: string[]; // Resolved next step ids from edges
  idempotencyKey?: string; // External call protection
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WorkflowEvent {
  eventId: string;
  tenantId: string;
  type: string; // "invoice.created", "manual.trigger", etc.
  payload: Record<string, unknown>;
  correlationId?: string;
  idempotencyKey?: string;
  timestamp: Timestamp;
}

export interface ActionExecutor {
  type: string;
  execute(
    step: StepDefinition,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>>;
}

export interface WorkflowTrigger {
  type: string;
  handler(
    event: WorkflowEvent,
    workflows: WorkflowDefinition[]
  ): Promise<void>;
}
