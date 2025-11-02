import { 
  Workflow, 
  WorkflowExecution, 
  WorkflowStep, 
  WorkflowAction, 
  WorkflowActionType,
  WorkflowCondition,
  WorkflowExecutionLog,
} from "@/core";
import { repositoryHost } from "@/repositories";
import { databaseService } from "../database/database-service";
import { emailService } from "./email-service";

const workflowRepository = repositoryHost.getWorkflowsRepository(databaseService);

export interface WorkflowExecutionContext {
  workflow: Workflow;
  execution: WorkflowExecution;
  triggerData: Record<string, unknown>;
  variables: Record<string, unknown>;
}

export interface ActionExecutor {
  type: WorkflowActionType;
  execute: (action: WorkflowAction, context: WorkflowExecutionContext) => Promise<{
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
  }>;
}

export class WorkflowExecutionEngine {
  private actionExecutors: Map<WorkflowActionType, ActionExecutor> = new Map();

  constructor() {
    this.initializeActionExecutors();
  }

  private initializeActionExecutors(): void {
    // Email actions
    this.actionExecutors.set("send_email", {
      type: "send_email",
      execute: this.executeEmailAction.bind(this),
    });

    // HTTP Request actions
    this.actionExecutors.set("http_request", {
      type: "http_request",
      execute: this.executeHttpRequestAction.bind(this),
    });
  }

  /**
   * Execute a workflow with the given trigger data
   */
  async executeWorkflow(
    workflowId: string, 
    triggerData: Record<string, unknown> = {}
  ): Promise<string> {
    const workflow = await workflowRepository.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Create execution record
    const executionId = await workflowRepository.createExecution(workflowId, triggerData);
    
    // Start execution in background
    this.executeWorkflowAsync(workflow, executionId, triggerData);
    
    return executionId;
  }

  /**
   * Execute workflow asynchronously
   */
  private async executeWorkflowAsync(
    workflow: Workflow,
    executionId: string,
    triggerData: Record<string, unknown>
  ): Promise<void> {
    try {
      // Update execution status to running
      await workflowRepository.updateExecution(executionId, {
        status: "running",
        startedAt: new Date().toISOString(),
      });

      const context: WorkflowExecutionContext = {
        workflow,
        execution: await workflowRepository.getExecution(executionId) || {
          id: executionId,
          workflowId: workflow.id,
          status: "running" as const,
          triggerType: workflow.trigger.type,
          startedAt: new Date().toISOString(),
          logs: [],
        },
        triggerData,
        variables: { ...triggerData },
      };

      // Execute workflow steps in order
      const sortedSteps = workflow.steps.sort((a, b) => a.order - b.order);
      
      for (const step of sortedSteps) {
        await this.executeStep(step, context);
      }

      // Mark execution as completed
      await workflowRepository.updateExecution(executionId, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      await this.addExecutionLog(executionId, {
        stepId: "workflow",
        actionType: "http_request",
        status: "completed",
        message: "Workflow execution completed successfully",
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Workflow execution failed:`, error);
      
      await workflowRepository.updateExecution(executionId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: errorMessage,
      });

      await this.addExecutionLog(executionId, {
        stepId: "workflow",
        actionType: "http_request",
        status: "failed",
        message: "Workflow execution failed",
        error: errorMessage,
      });
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: WorkflowStep, context: WorkflowExecutionContext): Promise<void> {
    const executionId = context.execution.id;
    
    await this.addExecutionLog(executionId, {
      stepId: step.id,
      actionType: "http_request",
      status: "started",
      message: `Executing step: ${step.name}`,
    });

    try {
      // Check conditions if any
      if (step.conditions && step.conditions.length > 0) {
        const conditionsMet = await this.evaluateConditions(step.conditions, context);
        if (!conditionsMet) {
          await this.addExecutionLog(executionId, {
            stepId: step.id,
            actionType: "http_request",
            status: "completed",
            message: `Step skipped: conditions not met`,
          });
          return;
        }
      }

      // Execute actions
      for (const action of step.actions) {
        await this.executeAction(action, context, executionId, step.id);
      }

      // Handle delay if specified
      if (step.delaySeconds && step.delaySeconds > 0) {
        await this.executeDelay(step.delaySeconds);
      }

      await this.addExecutionLog(executionId, {
        stepId: step.id,
        actionType: "http_request",
        status: "completed",
        message: `Step completed: ${step.name}`,
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.addExecutionLog(executionId, {
        stepId: step.id,
        actionType: "http_request",
        status: "failed",
        message: `Step failed: ${step.name}`,
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: WorkflowAction, 
    context: WorkflowExecutionContext,
    executionId: string,
    stepId: string
  ): Promise<void> {
    const executor = this.actionExecutors.get(action.type);
    if (!executor) {
      await this.addExecutionLog(executionId, {
        stepId,
        actionType: action.type,
        status: "failed",
        message: `No executor found for action type: ${action.type}`,
        error: `Unsupported action type: ${action.type}`,
      });
      throw new Error(`No executor found for action type: ${action.type}`);
    }

    await this.addExecutionLog(executionId, {
      stepId,
      actionType: action.type,
      status: "started",
      message: `Executing action: ${action.name}`,
    });

    const startTime = Date.now();
    const result = await executor.execute(action, context);
    const duration = Date.now() - startTime;
    
    if (!result.success) {
      await this.addExecutionLog(executionId, {
        stepId,
        actionType: action.type,
        status: "failed",
        message: `Action failed: ${action.name}`,
        error: result.error || `Action ${action.type} failed`,
        duration,
      });
      throw new Error(result.error || `Action ${action.type} failed`);
    }

    await this.addExecutionLog(executionId, {
      stepId,
      actionType: action.type,
      status: "completed",
      message: `Action completed: ${action.name}`,
      duration,
      data: result.result,
    });

    // Update context variables with result
    if (result.result) {
      Object.assign(context.variables, result.result);
    }
  }

  /**
   * Evaluate workflow conditions
   */
  private async evaluateConditions(
    conditions: WorkflowCondition[], 
    context: WorkflowExecutionContext
  ): Promise<boolean> {
    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(condition.field, context);
      const conditionMet = this.evaluateCondition(condition, fieldValue);
      
      if (!conditionMet) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get field value from context
   */
  private getFieldValue(field: string, context: WorkflowExecutionContext): unknown {
    // Handle nested field access (e.g., "invoice.amount")
    const parts = field.split('.');
    let value: unknown = context.variables;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && value !== null && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: WorkflowCondition, fieldValue: unknown): boolean {
    switch (condition.operator) {
      case "equals":
        return fieldValue === condition.value;
      case "not_equals":
        return fieldValue !== condition.value;
      case "greater_than":
        return Number(fieldValue) > Number(condition.value);
      case "less_than":
        return Number(fieldValue) < Number(condition.value);
      case "contains":
        return String(fieldValue).includes(String(condition.value));
      case "not_contains":
        return !String(fieldValue).includes(String(condition.value));
      case "is_empty":
        return fieldValue === null || fieldValue === undefined || fieldValue === "";
      case "is_not_empty":
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";
      default:
        return false;
    }
  }

  /**
   * Add execution log
   */
  private async addExecutionLog(
    executionId: string, 
    log: Omit<WorkflowExecutionLog, "timestamp">
  ): Promise<void> {
    await workflowRepository.addExecutionLog(executionId, log);
  }

  /**
   * Execute delay
   */
  private async executeDelay(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  // Action Executors

  private async executeEmailAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      // Check if config matches email schema
      if (action.type !== "send_email") {
        throw new Error(`Invalid action type for email executor: ${action.type}`);
      }

      // Type guard for email config
      if (!('recipients' in action.config && Array.isArray(action.config.recipients))) {
        throw new Error("Email action must have recipients array");
      }

      const { recipients, subject, body, isHtml = false } = action.config as {
        recipients: string[];
        subject: string;
        body: string;
        isHtml?: boolean;
      };
      
      if (!recipients || recipients.length === 0 || !subject || !body) {
        throw new Error("Email recipients, subject, and body are required");
      }

      // Replace variables in email content
      const processedRecipients = recipients.map(r => this.replaceVariables(r, context.variables));
      const processedSubject = this.replaceVariables(subject, context.variables);
      const processedBody = this.replaceVariables(body, context.variables);

      // Send email using email service
      await emailService.sendEmail({
        to: processedRecipients[0], // Email service expects single recipient for now
        subject: processedSubject,
        ...(isHtml ? { html: processedBody } : { text: processedBody }),
      });

      return { success: true, result: { emailSent: true, recipients: processedRecipients } };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  private async executeHttpRequestAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      // Check if config matches HTTP request schema
      if (action.type !== "http_request") {
        throw new Error(`Invalid action type for HTTP executor: ${action.type}`);
      }

      // Type guard for HTTP request config
      if (!('url' in action.config && 'method' in action.config)) {
        throw new Error("HTTP request action must have url and method");
      }

      const { url, method, headers = {}, body, auth, timeoutMs } = action.config as {
        url: string;
        method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
        headers?: Record<string, string>;
        body?: unknown;
        auth?: {
          type: "bearer" | "basic" | "none";
          token?: string;
          username?: string;
          password?: string;
        };
        timeoutMs?: number;
      };
      
      if (!url || !method) {
        throw new Error("HTTP request URL and method are required");
      }

      // Replace variables in URL and headers
      const processedUrl = this.replaceVariables(url, context.variables);
      const processedHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers)) {
        processedHeaders[key] = this.replaceVariables(value, context.variables);
      }

      // Add authentication headers
      if (auth && auth.type !== "none") {
        if (auth.type === "bearer" && auth.token) {
          processedHeaders["Authorization"] = `Bearer ${this.replaceVariables(auth.token, context.variables)}`;
        } else if (auth.type === "basic" && auth.username && auth.password) {
          const credentials = btoa(
            `${this.replaceVariables(auth.username, context.variables)}:${this.replaceVariables(auth.password, context.variables)}`
          );
          processedHeaders["Authorization"] = `Basic ${credentials}`;
        }
      }

      // Process body
      let processedBody: string | undefined;
      if (body) {
        if (typeof body === 'string') {
          processedBody = this.replaceVariables(body, context.variables);
        } else {
          // Replace variables in JSON body
          const bodyStr = JSON.stringify(body);
          processedBody = this.replaceVariables(bodyStr, context.variables);
        }
      }

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

      try {
        const response = await fetch(processedUrl, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...processedHeaders,
          },
          body: processedBody,
          signal: controller.signal,
        });

        const responseData = await response.text();
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(responseData);
        } catch {
          parsedResponse = responseData;
        }

        if (!response.ok) {
          throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
        }

        if (timeoutId) clearTimeout(timeoutId);

        return { 
          success: true, 
          result: { 
            httpRequestCompleted: true, 
            status: response.status,
            data: parsedResponse,
          } 
        };
      } catch (fetchError: unknown) {
        if (timeoutId) clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(`HTTP request timeout after ${timeoutMs}ms`);
        }
        throw fetchError;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }


  /**
   * Replace variables in strings with actual values
   */
  private replaceVariables(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const value = variables[key.trim()];
      return value !== undefined ? String(value) : match;
    });
  }
}

// Export singleton instance
export const workflowExecutionEngine = new WorkflowExecutionEngine();
