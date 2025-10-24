import z from "zod";
import { baseEntitySchema } from "./base";

/**
 * Workflow trigger types that can initiate a workflow execution
 */
export const workflowTriggerTypeSchema = z.enum([
  "invoice.created",
  "invoice.sent", 
  "invoice.paid",
  "invoice.overdue",
  "proposal.created",
  "proposal.approved",
  "proposal.rejected",
  "contract.expiring",
  "contract.expired",
  "user.joined",
  "schedule.cron",
  "webhook.external",
  "manual.trigger"
]);

export type WorkflowTriggerType = z.infer<typeof workflowTriggerTypeSchema>;

/**
 * Workflow action types that can be executed as part of a workflow
 */
export const workflowActionTypeSchema = z.enum([
  "send.email",
  "send.slack",
  "create.invoice",
  "update.invoice.status",
  "create.task",
  "assign.task",
  "generate.pdf",
  "call.webhook",
  "create.stripe.invoice",
  "wait.delay",
  "notify.user",
  "archive.record",
  "update.field"
]);

export type WorkflowActionType = z.infer<typeof workflowActionTypeSchema>;

/**
 * Workflow condition operators for conditional logic
 */
export const workflowConditionOperatorSchema = z.enum([
  "equals",
  "not_equals", 
  "greater_than",
  "less_than",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty"
]);

export type WorkflowConditionOperator = z.infer<typeof workflowConditionOperatorSchema>;

/**
 * Workflow execution status
 */
export const workflowExecutionStatusSchema = z.enum([
  "pending",
  "running", 
  "completed",
  "failed",
  "cancelled"
]);

export type WorkflowExecutionStatus = z.infer<typeof workflowExecutionStatusSchema>;

/**
 * Workflow trigger configuration
 */
export const workflowTriggerSchema = z.object({
  type: workflowTriggerTypeSchema,
  config: z.record(z.string(), z.any()).optional(),
  // For cron triggers
  cronExpression: z.string().optional(),
  // For webhook triggers  
  webhookUrl: z.string().url().optional(),
  // For event triggers
  eventFilters: z.record(z.string(), z.any()).optional(),
});

export type WorkflowTrigger = z.infer<typeof workflowTriggerSchema>;

/**
 * Workflow condition for conditional branching
 */
export const workflowConditionSchema = z.object({
  field: z.string(), // e.g., "invoice.amount", "invoice.status"
  operator: workflowConditionOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export type WorkflowCondition = z.infer<typeof workflowConditionSchema>;

/**
 * Workflow action configuration
 */
export const workflowActionSchema = z.object({
  type: workflowActionTypeSchema,
  config: z.record(z.string(), z.any()),
  // For conditional actions
  conditions: z.array(workflowConditionSchema).optional(),
  // For delay actions
  delaySeconds: z.number().int().min(0).optional(),
  // For email actions
  templateId: z.string().optional(),
  recipient: z.string().optional(),
  subject: z.string().optional(),
  // For webhook actions
  url: z.string().url().optional(),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  // For task actions
  assigneeId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export type WorkflowAction = z.infer<typeof workflowActionSchema>;

/**
 * Workflow step that can contain actions and conditions
 */
export const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["action", "condition", "delay", "parallel"]),
  actions: z.array(workflowActionSchema),
  conditions: z.array(workflowConditionSchema).optional(),
  // For parallel steps
  parallelSteps: z.array(z.string()).optional(), // References to other step IDs
  // For delay steps
  delaySeconds: z.number().int().min(0).optional(),
  // Step execution order
  order: z.number().int().min(0),
});

export type WorkflowStep = z.infer<typeof workflowStepSchema>;

/**
 * Workflow execution log entry
 */
export const workflowExecutionLogSchema = z.object({
  stepId: z.string(),
  actionType: workflowActionTypeSchema,
  status: z.enum(["started", "completed", "failed"]),
  message: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
  duration: z.number().optional(), // milliseconds
  data: z.record(z.string(), z.any()).optional(),
});

export type WorkflowExecutionLog = z.infer<typeof workflowExecutionLogSchema>;

/**
 * Workflow execution record
 */
export const workflowExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  status: workflowExecutionStatusSchema,
  triggerType: workflowTriggerTypeSchema,
  triggerData: z.record(z.string(), z.any()).optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  logs: z.array(workflowExecutionLogSchema).default([]),
  error: z.string().optional(),
  context: z.record(z.string(), z.any()).optional(), // Execution context data
});

export type WorkflowExecution = z.infer<typeof workflowExecutionSchema>;

/**
 * Helper type for creating workflow executions.
 * Omits server-managed fields.
 */
export type WorkflowExecutionData = Omit<WorkflowExecution, "id" | "startedAt" | "completedAt">;

/**
 * Main workflow entity
 */
export const workflowDataSchema = z.object({
  // Organization ID for multi-tenancy
  orgId: z.string().min(1),
  
  // Basic workflow info
  name: z.string().min(1),
  description: z.string().optional(),
  
  // Workflow configuration
  trigger: workflowTriggerSchema,
  steps: z.array(workflowStepSchema),
  
  // Workflow status
  status: z.enum(["draft", "active", "paused", "archived"]).default("draft"),
  
  // Versioning
  version: z.number().int().min(1).default(1),
  
  // Settings
  settings: z.object({
    // Execution settings
    maxRetries: z.number().int().min(0).default(3),
    timeoutSeconds: z.number().int().min(1).default(300),
    // Notification settings
    notifyOnFailure: z.boolean().default(true),
    notifyOnSuccess: z.boolean().default(false),
    // Execution limits
    maxConcurrentExecutions: z.number().int().min(1).default(10),
  }).default({
    maxRetries: 3,
    timeoutSeconds: 300,
    notifyOnFailure: true,
    notifyOnSuccess: false,
    maxConcurrentExecutions: 10,
  }),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  
  // n8n integration
  n8nWorkflowId: z.string().optional(), // Reference to n8n workflow
  n8nEnabled: z.boolean().default(false),
});

export type WorkflowData = z.infer<typeof workflowDataSchema>;

export const workflowSchema = baseEntitySchema.merge(workflowDataSchema);
export type Workflow = z.infer<typeof workflowSchema>;

/**
 * Helper type for creating workflows
 */
export type CreateWorkflowInput = Omit<WorkflowData, "version" | "n8nEnabled"> & {
  version?: number;
  n8nEnabled?: boolean;
};

/**
 * Helper type for updating workflows
 */
export type UpdateWorkflowInput = Partial<Pick<WorkflowData, 
  "name" | "description" | "trigger" | "steps" | "status" | "settings" | "tags" | "category"
>>;

/**
 * Workflow template for common use cases
 */
export const workflowTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  trigger: workflowTriggerSchema,
  steps: z.array(workflowStepSchema),
  tags: z.array(z.string()),
  isBuiltIn: z.boolean().default(false),
});

export type WorkflowTemplate = z.infer<typeof workflowTemplateSchema>;

/**
 * Helper functions for workflow operations
 */

/**
 * Check if a workflow is active and can be executed
 */
export function isWorkflowActive(workflow: Workflow): boolean {
  return workflow.status === "active";
}

/**
 * Check if a workflow execution is still running
 */
export function isExecutionRunning(execution: WorkflowExecution): boolean {
  return execution.status === "running" || execution.status === "pending";
}

/**
 * Get the next step in a workflow based on current execution context
 */
export function getNextStep(workflow: Workflow, currentStepId?: string): WorkflowStep | null {
  const steps = workflow.steps.sort((a, b) => a.order - b.order);
  
  if (!currentStepId) {
    return steps[0] || null;
  }
  
  const currentIndex = steps.findIndex(step => step.id === currentStepId);
  if (currentIndex === -1 || currentIndex >= steps.length - 1) {
    return null;
  }
  
  return steps[currentIndex + 1];
}

/**
 * Validate workflow configuration
 */
export function validateWorkflow(workflow: WorkflowData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if workflow has at least one step
  if (workflow.steps.length === 0) {
    errors.push("Workflow must have at least one step");
  }
  
  // Check if steps have valid order
  const orders = workflow.steps.map(step => step.order);
  const uniqueOrders = new Set(orders);
  if (orders.length !== uniqueOrders.size) {
    errors.push("Workflow steps must have unique order values");
  }
  
  // Check if trigger is properly configured
  if (workflow.trigger.type === "schedule.cron" && !workflow.trigger.cronExpression) {
    errors.push("Cron trigger must have a cron expression");
  }
  
  if (workflow.trigger.type === "webhook.external" && !workflow.trigger.webhookUrl) {
    errors.push("Webhook trigger must have a webhook URL");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
