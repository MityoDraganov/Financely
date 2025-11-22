import z from "zod";
import { baseEntitySchema } from "./base";

/**
 * Workflow trigger types that can initiate a workflow execution
 */
export const workflowTriggerTypeSchema = z.enum([
  // Invoice triggers
  "invoice.created",
  "invoice.sent", 
  "invoice.paid",
  "invoice.overdue",
  // Proposal triggers
  "proposal.created",
  "proposal.approved",
  "proposal.rejected",
  "proposal.sent",
  "proposal.converted_to_invoice",
  // Contract triggers
  "contract.expiring",
  "contract.expired",
  // Lead triggers
  "lead.created",
  "lead.converted",
  "lead.qualified",
  // Contact triggers
  "contact.created",
  "contact.updated",
  // Product triggers
  "product.created",
  "product.low_stock",
  // User triggers
  "user.joined",
  // System triggers
  "schedule.cron",
  "webhook.external",
  "manual.trigger"
]);

export type WorkflowTriggerType = z.infer<typeof workflowTriggerTypeSchema>;

/**
 * Workflow action types that can be executed as part of a workflow
 */
export const workflowActionTypeSchema = z.enum([
  // Communication actions
  "send.email",
  "send.slack",
  // Invoice actions
  "update.invoice.status",
  "generate.pdf",
  // Proposal actions
  "create.proposal",
  "send.proposal",
  "convert.proposal_to_invoice",
  // Lead actions
  "create.lead",
  "update.lead.status",
  "convert.lead_to_contact",
  // Contact actions
  "create.contact",
  "update.contact",
  // Product actions
  "add.product_to_proposal",
  // Integration actions
  "call.webhook",
  "http_request", // Keep for backward compatibility
  "create.stripe.invoice",
  // System actions
  "wait.delay",
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
  id: z.string(),
  type: workflowActionTypeSchema,
  name: z.string(),
  config: z.union([
    // HTTP Request configuration (for call.webhook, http_request)
    z.object({
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
      url: z.string(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.any().optional(),
      auth: z.object({
        type: z.enum(["bearer", "basic", "none"]),
        token: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
      }).optional(),
      timeoutMs: z.number().int().min(0).optional(),
    }),
    // Email configuration (for send.email)
    z.object({
      recipients: z.array(z.string().email()),
      subject: z.string(),
      body: z.string(),
      isHtml: z.boolean().default(false),
      cc: z.array(z.string().email()).optional(),
      bcc: z.array(z.string().email()).optional(),
      replyTo: z.string().email().optional(),
      attachments: z.array(z.object({
        filename: z.string(),
        content: z.string(), // Base64 encoded content
        contentType: z.string(),
      })).optional(),
    }),
    // Slack configuration (for send.slack)
    z.object({
      channel: z.string(),
      message: z.string(),
      webhookUrl: z.string().url().optional(),
    }),
    // Update invoice status configuration (for update.invoice.status)
    z.object({
      invoiceId: z.string(),
      status: z.enum(["draft", "sent", "paid", "cancelled"]),
    }),
    // Create proposal configuration (for create.proposal)
    z.object({
      clientId: z.string(),
      items: z.array(z.object({
        description: z.string(),
        quantity: z.number().min(0),
        price: z.number().min(0),
      })),
      validUntil: z.string().optional(),
    }),
    // Send proposal configuration (for send.proposal)
    z.object({
      proposalId: z.string(),
      recipientEmail: z.string().email(),
      subject: z.string().optional(),
      message: z.string().optional(),
    }),
    // Convert proposal to invoice configuration (for convert.proposal_to_invoice)
    z.object({
      proposalId: z.string(),
    }),
    // Create lead configuration (for create.lead)
    z.object({
      name: z.string(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      source: z.string().optional(),
      status: z.enum(["new", "viewed", "contacted", "converted", "archived"]).optional(),
    }),
    // Update lead status configuration (for update.lead.status)
    z.object({
      leadId: z.string(),
      status: z.enum(["new", "viewed", "contacted", "converted", "archived"]),
    }),
    // Convert lead to contact configuration (for convert.lead_to_contact)
    z.object({
      leadId: z.string(),
    }),
    // Create contact configuration (for create.contact)
    z.object({
      name: z.string(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
    }),
    // Update contact configuration (for update.contact)
    z.object({
      contactId: z.string(),
      updates: z.record(z.string(), z.any()),
    }),
    // Add product to proposal configuration (for add.product_to_proposal)
    z.object({
      proposalId: z.string(),
      productId: z.string(),
      quantity: z.number().min(0).optional(),
    }),
    // Generate PDF configuration (for generate.pdf)
    z.object({
      documentId: z.string(),
      documentType: z.enum(["invoice", "proposal", "contract"]),
      templateId: z.string().optional(),
    }),
    // Create Stripe invoice configuration (for create.stripe.invoice)
    z.object({
      invoiceId: z.string(),
      customerId: z.string(),
    }),
    // Wait delay configuration (for wait.delay)
    z.object({
      delaySeconds: z.number().int().min(0),
    }),
    // Archive record configuration (for archive.record)
    z.object({
      recordId: z.string(),
      recordType: z.enum(["invoice", "proposal", "lead", "contact", "task"]),
    }),
    // Update field configuration (for update.field)
    z.object({
      recordId: z.string(),
      recordType: z.enum(["invoice", "proposal", "lead", "contact", "task"]),
      field: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }),
  ]),
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
  // For conditional steps - nested steps for each branch
  trueBranchSteps: z.array(z.lazy(() => workflowStepSchema)).optional(),
  falseBranchSteps: z.array(z.lazy(() => workflowStepSchema)).optional(),
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
