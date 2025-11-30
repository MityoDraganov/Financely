import { WorkflowStep, WorkflowAction, WorkflowData, WorkflowTriggerType, WorkflowCondition } from "@/core";

export interface ValidationError {
  field: string;
  message: string;
}

export interface StepValidationErrors {
  [stepId: string]: string[];
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: ValidationError[];
  stepErrors: StepValidationErrors;
}

/**
 * Validate a single workflow action
 */
export function validateAction(action: WorkflowAction): string[] {
  const errors: string[] = [];

  if (!action.type) {
    errors.push("Action type is required");
  }

  if (!action.name || action.name.trim() === "") {
    errors.push("Action name is required");
  }

  // Validate action-specific configs
  switch (action.type) {
    case "send.email": {
      const config = action.config as { recipients?: string[]; subject?: string; body?: string };
      if (!config.recipients || config.recipients.length === 0) {
        errors.push("Email recipients are required");
      }
      if (!config.subject || config.subject.trim() === "") {
        errors.push("Email subject is required");
      }
      if (!config.body || config.body.trim() === "") {
        errors.push("Email body is required");
      }
      break;
    }

    case "call.webhook":
    case "http_request": {
      const config = action.config as { url?: string; method?: string };
      if (!config.url || config.url.trim() === "") {
        errors.push("Webhook URL is required");
      }
      if (!config.method) {
        errors.push("HTTP method is required");
      }
      break;
    }

    case "create.proposal": {
      const config = action.config as { clientId?: string };
      if (!config.clientId || config.clientId.trim() === "") {
        errors.push("Client ID is required for proposal creation");
      }
      break;
    }

    case "wait.delay": {
      const config = action.config as { delaySeconds?: number };
      if (typeof config.delaySeconds !== "number" || config.delaySeconds <= 0) {
        errors.push("Valid delay duration is required");
      }
      break;
    }
  }

  return errors;
}

/**
 * Validate a single workflow step
 */
export function validateStep(step: WorkflowStep, index: number): string[] {
  const errors: string[] = [];

  if (!step.name || step.name.trim() === "") {
    errors.push("Step name is required");
  }

  if (!step.type) {
    errors.push("Step type is required");
  }

  // Validate step type-specific requirements
  switch (step.type) {
    case "action":
      if (!step.actions || step.actions.length === 0) {
        errors.push("Action steps must have at least one action");
      } else {
        step.actions.forEach((action: WorkflowAction, actionIndex: number) => {
          const actionErrors = validateAction(action);
          if (actionErrors.length > 0) {
            errors.push(`Action ${actionIndex + 1}: ${actionErrors.join(", ")}`);
          }
        });
      }
      break;

    case "condition":
      if (!step.conditions || step.conditions.length === 0) {
        errors.push("Conditional steps must have at least one condition");
      } else {
        step.conditions.forEach((condition: WorkflowCondition, conditionIndex: number) => {
          if (!condition.field || condition.field.trim() === "") {
            errors.push(`Condition ${conditionIndex + 1}: Field is required`);
          }
          if (!condition.operator) {
            errors.push(`Condition ${conditionIndex + 1}: Operator is required`);
          }
        });
      }
      break;

    case "delay":
      if (step.delaySeconds === undefined || step.delaySeconds < 0) {
        errors.push("Delay duration must be a positive number");
      }
      break;

    case "parallel":
      if (!step.parallelSteps || step.parallelSteps.length === 0) {
        errors.push("Parallel steps must reference at least one step");
      }
      break;
  }

  // Validate order
  if (step.order !== index) {
    errors.push(`Step order mismatch: expected ${index}, got ${step.order}`);
  }

  return errors;
}

/**
 * Validate trigger configuration
 */
export function validateTrigger(trigger: { type: WorkflowTriggerType; [key: string]: unknown }): string[] {
  const errors: string[] = [];

  if (!trigger.type) {
    errors.push("Trigger type is required");
    return errors;
  }

  switch (trigger.type) {
    case "schedule.cron":
      if (!trigger.cronExpression || (trigger.cronExpression as string).trim() === "") {
        errors.push("Cron expression is required for scheduled triggers");
      }
      break;

    case "webhook.external":
      if (!trigger.webhookUrl || (trigger.webhookUrl as string).trim() === "") {
        errors.push("Webhook URL is required for webhook triggers");
      }
      break;
  }

  return errors;
}

/**
 * Validate entire workflow
 */
export function validateWorkflowRealTime(workflow: Partial<WorkflowData>): WorkflowValidationResult {
  const errors: ValidationError[] = [];
  const stepErrors: StepValidationErrors = {};

  // Validate workflow name
  if (!workflow.name || workflow.name.trim() === "") {
    errors.push({
      field: "name",
      message: "Workflow name is required",
    });
  }

  // Validate trigger
  if (!workflow.trigger) {
    errors.push({
      field: "trigger",
      message: "Workflow trigger is required",
    });
  } else {
    const triggerErrors = validateTrigger(workflow.trigger);
    triggerErrors.forEach(error => {
      errors.push({
        field: "trigger",
        message: error,
      });
    });
  }

  // Validate steps
  if (!workflow.steps || workflow.steps.length === 0) {
    errors.push({
      field: "steps",
      message: "Workflow must have at least one step",
    });
  } else {
    // Check for duplicate step IDs
    const stepIds = new Set<string>();
    workflow.steps.forEach(step => {
      if (stepIds.has(step.id)) {
        errors.push({
          field: `steps.${step.id}`,
          message: `Duplicate step ID: ${step.id}`,
        });
      }
      stepIds.add(step.id);
    });

    // Validate each step
    workflow.steps.forEach((step, index) => {
      const stepValidationErrors = validateStep(step, index);
      if (stepValidationErrors.length > 0) {
        stepErrors[step.id] = stepValidationErrors;
        stepValidationErrors.forEach(error => {
          errors.push({
            field: `steps.${step.id}`,
            message: error,
          });
        });
      }

      // Validate step order uniqueness
      const orders = workflow.steps!.map(s => s.order);
      const uniqueOrders = new Set(orders);
      if (orders.length !== uniqueOrders.size) {
        errors.push({
          field: "steps",
          message: "Step orders must be unique",
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    stepErrors,
  };
}

/**
 * Get validation error message for a specific field
 */
export function getFieldError(
  validationResult: WorkflowValidationResult,
  field: string
): string | undefined {
  const error = validationResult.errors.find(e => e.field === field);
  return error?.message;
}

/**
 * Get validation errors for a specific step
 */
export function getStepErrors(
  validationResult: WorkflowValidationResult,
  stepId: string
): string[] {
  return validationResult.stepErrors[stepId] || [];
}

