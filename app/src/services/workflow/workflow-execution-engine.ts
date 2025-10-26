import { 
  Workflow, 
  WorkflowExecution, 
  WorkflowStep, 
  WorkflowAction, 
  WorkflowActionType,
  WorkflowCondition,
  WorkflowExecutionStatus,
  WorkflowExecutionLog,
  WorkflowTriggerType
} from "@/core";
import { repositoryHost } from "@/repositories";
import { databaseService } from "../database/database-service";
import { emailService } from "./email-service";
import { loggerService } from "./logger-service";

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
    this.actionExecutors.set("send.email", {
      type: "send.email",
      execute: this.executeEmailAction.bind(this),
    });

    // Slack actions
    this.actionExecutors.set("send.slack", {
      type: "send.slack",
      execute: this.executeSlackAction.bind(this),
    });

    // Invoice actions
    this.actionExecutors.set("create.invoice", {
      type: "create.invoice",
      execute: this.executeCreateInvoiceAction.bind(this),
    });

    this.actionExecutors.set("update.invoice.status", {
      type: "update.invoice.status",
      execute: this.executeUpdateInvoiceStatusAction.bind(this),
    });

    // Task actions
    this.actionExecutors.set("create.task", {
      type: "create.task",
      execute: this.executeCreateTaskAction.bind(this),
    });

    this.actionExecutors.set("assign.task", {
      type: "assign.task",
      execute: this.executeAssignTaskAction.bind(this),
    });

    // PDF actions
    this.actionExecutors.set("generate.pdf", {
      type: "generate.pdf",
      execute: this.executeGeneratePdfAction.bind(this),
    });

    // Webhook actions
    this.actionExecutors.set("call.webhook", {
      type: "call.webhook",
      execute: this.executeWebhookAction.bind(this),
    });

    // Stripe actions
    this.actionExecutors.set("create.stripe.invoice", {
      type: "create.stripe.invoice",
      execute: this.executeStripeInvoiceAction.bind(this),
    });

    // Delay actions
    this.actionExecutors.set("wait.delay", {
      type: "wait.delay",
      execute: this.executeDelayAction.bind(this),
    });

    // Notification actions
    this.actionExecutors.set("notify.user", {
      type: "notify.user",
      execute: this.executeNotifyUserAction.bind(this),
    });

    // Archive actions
    this.actionExecutors.set("archive.record", {
      type: "archive.record",
      execute: this.executeArchiveRecordAction.bind(this),
    });

    // Update field actions
    this.actionExecutors.set("update.field", {
      type: "update.field",
      execute: this.executeUpdateFieldAction.bind(this),
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
        execution: await workflowRepository.getExecution(executionId)!,
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
        actionType: "notify.user",
        status: "completed",
        message: "Workflow execution completed successfully",
      });

    } catch (error: any) {
      console.error(`Workflow execution failed:`, error);
      
      await workflowRepository.updateExecution(executionId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: error.message,
      });

      await this.addExecutionLog(executionId, {
        stepId: "workflow",
        actionType: "notify.user",
        status: "failed",
        message: "Workflow execution failed",
        error: error.message,
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
      actionType: "notify.user",
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
            actionType: "notify.user",
            status: "completed",
            message: `Step skipped: conditions not met`,
          });
          return;
        }
      }

      // Execute actions
      for (const action of step.actions) {
        await this.executeAction(action, context);
      }

      // Handle delay if specified
      if (step.delaySeconds && step.delaySeconds > 0) {
        await this.executeDelay(step.delaySeconds);
      }

      await this.addExecutionLog(executionId, {
        stepId: step.id,
        actionType: "notify.user",
        status: "completed",
        message: `Step completed: ${step.name}`,
      });

    } catch (error: any) {
      await this.addExecutionLog(executionId, {
        stepId: step.id,
        actionType: "notify.user",
        status: "failed",
        message: `Step failed: ${step.name}`,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: WorkflowAction, 
    context: WorkflowExecutionContext
  ): Promise<void> {
    const executor = this.actionExecutors.get(action.type);
    if (!executor) {
      throw new Error(`No executor found for action type: ${action.type}`);
    }

    const result = await executor.execute(action, context);
    
    if (!result.success) {
      throw new Error(result.error || `Action ${action.type} failed`);
    }

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
    let value: any = context.variables;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
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
    log: Omit<WorkflowExecutionLog, "timestamp" | "duration">
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
      const { recipient, subject, templateId } = action.config;
      
      if (!recipient || !subject) {
        throw new Error("Email recipient and subject are required");
      }

      // Replace variables in email content
      const processedRecipient = this.replaceVariables(recipient, context.variables);
      const processedSubject = this.replaceVariables(subject, context.variables);

      // Send email using email service
      await emailService.sendEmail({
        to: processedRecipient,
        subject: processedSubject,
        templateId: templateId,
        data: context.variables,
      });

      return { success: true, result: { emailSent: true } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeSlackAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const { channel, message, webhookUrl } = action.config;
      
      if (!webhookUrl || !message) {
        throw new Error("Slack webhook URL and message are required");
      }

      const processedMessage = this.replaceVariables(message, context.variables);

      // Send Slack message via webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: channel,
          text: processedMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
      }

      return { success: true, result: { slackMessageSent: true } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeCreateInvoiceAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const { customerId, amount, description, dueDate } = action.config;
      
      if (!customerId || !amount) {
        throw new Error("Customer ID and amount are required for invoice creation");
      }

      // Create invoice using invoice service
      const invoiceData = {
        customerId: this.replaceVariables(customerId, context.variables),
        amount: Number(this.replaceVariables(amount, context.variables)),
        description: this.replaceVariables(description || "", context.variables),
        dueDate: dueDate ? new Date(this.replaceVariables(dueDate, context.variables)) : undefined,
      };

      // Create invoice using existing invoice service
      try {
        const { functionsService } = await import("@/services/functions/functions-service");
        const result = await functionsService.createInvoice({
          customerId: invoiceData.customerId,
          amount: invoiceData.amount,
          description: invoiceData.description,
          dueDate: invoiceData.dueDate,
        });
        
        return { success: true, result: { invoiceCreated: true, invoiceId: result.id } };
      } catch (error: any) {
        return { success: false, error: `Failed to create invoice: ${error.message}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeUpdateInvoiceStatusAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const { invoiceId, status } = action.config;
      
      if (!invoiceId || !status) {
        throw new Error("Invoice ID and status are required");
      }

      const processedInvoiceId = this.replaceVariables(invoiceId, context.variables);
      const processedStatus = this.replaceVariables(status, context.variables);

      // Update invoice status using repository
      try {
        const { repositoryHost } = await import("@/repositories");
        const { databaseService } = await import("@/services/database/database-service");
        const invoiceRepository = repositoryHost.getInvoicesRepository(databaseService);
        
        await invoiceRepository.update(processedInvoiceId, { status: processedStatus });
        
        return { success: true, result: { invoiceStatusUpdated: true } };
      } catch (error: any) {
        return { success: false, error: `Failed to update invoice status: ${error.message}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeCreateTaskAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const { title, description, assigneeId, priority } = action.config;
      
      if (!title) {
        throw new Error("Task title is required");
      }

      const taskData = {
        title: this.replaceVariables(title, context.variables),
        description: this.replaceVariables(description || "", context.variables),
        assigneeId: assigneeId ? this.replaceVariables(assigneeId, context.variables) : undefined,
        priority: priority || "medium",
      };

      // Create task using database
      try {
        const { repositoryHost } = await import("@/repositories");
        const { databaseService } = await import("@/services/database/database-service");
        const taskRepository = repositoryHost.getTasksRepository(databaseService);
        
        const taskId = await taskRepository.create({
          title: taskData.title,
          description: taskData.description,
          assigneeId: taskData.assigneeId,
          priority: taskData.priority,
          status: "pending",
          createdAt: new Date().toISOString(),
        });
        
        return { success: true, result: { taskCreated: true, taskId } };
      } catch (error: any) {
        return { success: false, error: `Failed to create task: ${error.message}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeAssignTaskAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const { taskId, assigneeId } = action.config;
      
      if (!taskId || !assigneeId) {
        throw new Error("Task ID and assignee ID are required");
      }

      const processedTaskId = this.replaceVariables(taskId, context.variables);
      const processedAssigneeId = this.replaceVariables(assigneeId, context.variables);

      // Assign task using database
      try {
        const { repositoryHost } = await import("@/repositories");
        const { databaseService } = await import("@/services/database/database-service");
        const taskRepository = repositoryHost.getTasksRepository(databaseService);
        
        await taskRepository.update(processedTaskId, { 
          assigneeId: processedAssigneeId,
          updatedAt: new Date().toISOString()
        });
        
        return { success: true, result: { taskAssigned: true } };
      } catch (error: any) {
        return { success: false, error: `Failed to assign task: ${error.message}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeGeneratePdfAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const { templateId, data, outputPath } = action.config;
      
      if (!templateId) {
        throw new Error("Template ID is required for PDF generation");
      }

      // Generate PDF using existing PDF service
      try {
        const { functionsService } = await import("@/services/functions/functions-service");
        const result = await functionsService.renderInvoicePdf({
          templateId,
          data: context.variables,
          outputPath: outputPath || `pdf_${Date.now()}.pdf`,
        });
        
        return { success: true, result: { pdfGenerated: true, url: result.url } };
      } catch (error: any) {
        return { success: false, error: `Failed to generate PDF: ${error.message}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeWebhookAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const { url, method = "POST", headers = {}, body } = action.config;
      
      if (!url) {
        throw new Error("Webhook URL is required");
      }

      const processedUrl = this.replaceVariables(url, context.variables);
      const processedBody = body ? this.replaceVariables(JSON.stringify(body), context.variables) : undefined;

      const response = await fetch(processedUrl, {
        method: method as any,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: processedBody,
      });

      if (!response.ok) {
        throw new Error(`Webhook call failed: ${response.statusText}`);
      }

      return { success: true, result: { webhookCalled: true, status: response.status } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeStripeInvoiceAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const { customerId, amount, description } = action.config;
      
      if (!customerId || !amount) {
        throw new Error("Customer ID and amount are required for Stripe invoice");
      }

      // Create Stripe invoice using webhook integration
      try {
        const stripeData = {
          customer: customerId,
          amount: amount * 100, // Convert to cents
          currency: "usd",
          description: description,
        };
        
        const response = await fetch("/api/stripe/create-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stripeData),
        });
        
        if (!response.ok) {
          throw new Error(`Stripe API error: ${response.statusText}`);
        }
        
        const result = await response.json();
        return { success: true, result: { stripeInvoiceCreated: true, invoiceId: result.id } };
      } catch (error: any) {
        return { success: false, error: `Failed to create Stripe invoice: ${error.message}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeDelayAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const delaySeconds = action.delaySeconds || 0;
      
      if (delaySeconds > 0) {
        await this.executeDelay(delaySeconds);
      }

      return { success: true, result: { delayExecuted: true, delaySeconds } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeNotifyUserAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const { userId, message, type = "info" } = action.config;
      
      if (!userId || !message) {
        throw new Error("User ID and message are required");
      }

      const processedMessage = this.replaceVariables(message, context.variables);

      // Send user notification using database
      try {
        const { repositoryHost } = await import("@/repositories");
        const { databaseService } = await import("@/services/database/database-service");
        const notificationRepository = repositoryHost.getNotificationsRepository(databaseService);
        
        await notificationRepository.create({
          userId,
          message: processedMessage,
          type: type || "info",
          status: "unread",
          createdAt: new Date().toISOString(),
        });
        
        return { success: true, result: { userNotified: true } };
      } catch (error: any) {
        return { success: false, error: `Failed to notify user: ${error.message}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeArchiveRecordAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const { recordType, recordId } = action.config;
      
      if (!recordType || !recordId) {
        throw new Error("Record type and ID are required");
      }

      const processedRecordId = this.replaceVariables(recordId, context.variables);

      // Archive record using appropriate repository
      try {
        const { repositoryHost } = await import("@/repositories");
        const { databaseService } = await import("@/services/database/database-service");
        
        let repository;
        switch (recordType) {
          case "invoice":
            repository = repositoryHost.getInvoicesRepository(databaseService);
            break;
          case "proposal":
            repository = repositoryHost.getProposalsRepository(databaseService);
            break;
          case "contract":
            repository = repositoryHost.getContractsRepository(databaseService);
            break;
          default:
            throw new Error(`Unsupported record type: ${recordType}`);
        }
        
        await repository.update(processedRecordId, { 
          status: "archived",
          archivedAt: new Date().toISOString()
        });
        
        return { success: true, result: { recordArchived: true } };
      } catch (error: any) {
        return { success: false, error: `Failed to archive record: ${error.message}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private async executeUpdateFieldAction(action: WorkflowAction, context: WorkflowExecutionContext) {
    try {
      const { recordType, recordId, field, value } = action.config;
      
      if (!recordType || !recordId || !field || value === undefined) {
        throw new Error("Record type, ID, field, and value are required");
      }

      const processedRecordId = this.replaceVariables(recordId, context.variables);
      const processedValue = this.replaceVariables(String(value), context.variables);

      // Update field using appropriate repository
      try {
        const { repositoryHost } = await import("@/repositories");
        const { databaseService } = await import("@/services/database/database-service");
        
        let repository;
        switch (recordType) {
          case "invoice":
            repository = repositoryHost.getInvoicesRepository(databaseService);
            break;
          case "proposal":
            repository = repositoryHost.getProposalsRepository(databaseService);
            break;
          case "contract":
            repository = repositoryHost.getContractsRepository(databaseService);
            break;
          case "user":
            repository = repositoryHost.getUsersRepository(databaseService);
            break;
          default:
            throw new Error(`Unsupported record type: ${recordType}`);
        }
        
        const updateData = { [field]: processedValue, updatedAt: new Date().toISOString() };
        await repository.update(processedRecordId, updateData);
        
        return { success: true, result: { fieldUpdated: true } };
      } catch (error: any) {
        return { success: false, error: `Failed to update field: ${error.message}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
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
