import { onCall, HttpsError } from "firebase-functions/v2/https";
import { handleCreateWorkflow } from "../app/handle-create-workflow";
import { CreateWorkflowInput } from "../core/entities/workflow";
import { loggerService } from "../services/logger-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";

/**
 * Firebase Cloud Function for creating a workflow.
 *
 * This function accepts workflow configuration and creates a workflow record in the database.
 *
 * Request payload structure:
 * {
 *   orgId: string,
 *   name: string,
 *   description?: string,
 *   trigger: {
 *     type: "invoice.created" | "invoice.sent" | "invoice.paid" | "invoice.overdue" | "proposal.created" | "proposal.approved" | "proposal.rejected" | "contract.expiring" | "contract.expired" | "user.joined" | "schedule.cron" | "webhook.external" | "manual.trigger",
 *     config?: Record<string, any>,
 *     cronExpression?: string, // For cron triggers
 *     webhookUrl?: string, // For webhook triggers
 *     eventFilters?: Record<string, any> // For event triggers
 *   },
 *   steps: Array<{
 *     id: string,
 *     name: string,
 *     type: "action" | "condition" | "delay" | "parallel",
 *     actions: Array<{
 *       type: "send.email" | "send.slack" | "create.invoice" | "update.invoice.status" | "create.task" | "assign.task" | "generate.pdf" | "call.webhook" | "create.stripe.invoice" | "wait.delay" | "notify.user" | "archive.record" | "update.field",
 *       config: Record<string, any>,
 *       conditions?: Array<{
 *         field: string,
 *         operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "not_contains" | "is_empty" | "is_not_empty",
 *         value: string | number | boolean
 *       }>,
 *       delaySeconds?: number,
 *       templateId?: string,
 *       recipient?: string,
 *       subject?: string,
 *       url?: string,
 *       method?: "GET" | "POST" | "PUT" | "DELETE",
 *       headers?: Record<string, string>,
 *       assigneeId?: string,
 *       title?: string,
 *       description?: string
 *     }>,
 *     conditions?: Array<{
 *       field: string,
 *       operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "not_contains" | "is_empty" | "is_not_empty",
 *       value: string | number | boolean
 *     }>,
 *     parallelSteps?: string[], // References to other step IDs
 *     delaySeconds?: number,
 *     order: number
 *   }>,
 *   status?: "draft" | "active" | "paused" | "archived",
 *   version?: number,
 *   settings?: {
 *     maxRetries?: number,
 *     timeoutSeconds?: number,
 *     notifyOnFailure?: boolean,
 *     notifyOnSuccess?: boolean,
 *     maxConcurrentExecutions?: number
 *   },
 *   tags?: string[],
 *   category?: string,
 *   n8nEnabled?: boolean
 * }
 *
 * Response: string (workflow ID)
 *
 * @example
 * // Client call
 * const createWorkflow = httpsCallable(functions, 'createWorkflow');
 * const result = await createWorkflow({
 *   orgId: "org123",
 *   name: "Invoice Follow-up",
 *   description: "Automatically send follow-up emails for overdue invoices",
 *   trigger: {
 *     type: "invoice.overdue"
 *   },
 *   steps: [
 *     {
 *       id: "step1",
 *       name: "Send Reminder Email",
 *       type: "action",
 *       actions: [
 *         {
 *           type: "send.email",
 *           config: {
 *             templateId: "overdue-reminder",
 *             recipient: "{{invoice.customer.email}}",
 *             subject: "Payment Reminder - Invoice {{invoice.number}}"
 *           }
 *         }
 *       ],
 *       order: 0
 *     }
 *   ],
 *   tags: ["invoice", "automation"],
 *   category: "finance"
 * });
 * console.log("Workflow ID:", result.data); // "workflow789"
 */
export const createWorkflow = onCall<CreateWorkflowInput, Promise<{ id: string }>>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    try {
      const payload = request.data;

      // Basic validation
      if (!payload) {
        throw new HttpsError(
          "invalid-argument",
          "Request payload is required"
        );
      }

      if (!payload.orgId) {
        throw new HttpsError(
          "invalid-argument",
          "Organization ID (orgId) is required"
        );
      }

      // Verify authentication and organization membership
      // Only owner/admin can create workflows
      await verifyAuthAndOrgMembership(request, payload.orgId, {
        requireOwnerOrAdmin: true,
      });

      if (!payload.name || payload.name.trim().length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "Workflow name is required"
        );
      }

      if (!payload.trigger) {
        throw new HttpsError(
          "invalid-argument",
          "Workflow trigger configuration is required"
        );
      }

      if (!payload.steps || !Array.isArray(payload.steps) || payload.steps.length === 0) {
        throw new HttpsError(
          "invalid-argument",
          "Workflow must have at least one step"
        );
      }

      loggerService.info("Creating workflow", {
        orgId: payload.orgId,
        name: payload.name,
        triggerType: payload.trigger.type,
        stepsCount: payload.steps.length,
      });

      // Call application handler
      const workflowId = await handleCreateWorkflow(payload);

      loggerService.info("Workflow created successfully", { workflowId });

      return { id: workflowId };
    } catch (error: any) {
      loggerService.error("Failed to create workflow", {
        error: error.message,
        stack: error.stack,
      });

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Wrap other errors
      throw new HttpsError(
        "internal",
        `Failed to create workflow: ${error.message}`
      );
    }
  }
);
