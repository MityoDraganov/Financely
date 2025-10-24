import { CreateWorkflowInput, validateWorkflow } from "../core";
import { repositoryHost } from "../repositories";
import { databaseService } from "../infrastructure";
import { loggerService } from "../services/logger-service";

/**
 * Application handler for creating a workflow.
 * 
 * This function handles the business logic for creating a workflow,
 * including validation, data transformation, and database operations.
 * 
 * @param payload - The workflow creation payload
 * @returns Promise<string> - The created workflow ID
 */
export async function handleCreateWorkflow(payload: CreateWorkflowInput): Promise<string> {
  try {
    // Get the workflow repository
    const workflowRepository = repositoryHost.getWorkflowsRepository(databaseService);

    // Prepare workflow data with defaults
    const defaultSettings = {
      maxRetries: 3,
      timeoutSeconds: 300,
      notifyOnFailure: true,
      notifyOnSuccess: false,
      maxConcurrentExecutions: 10,
    };

    const workflowData = {
      ...payload,
      version: payload.version ?? 1,
      n8nEnabled: payload.n8nEnabled ?? false,
      status: payload.status ?? "draft",
      settings: {
        ...defaultSettings,
        ...payload.settings,
      },
      tags: payload.tags || [],
    };

    // Validate workflow configuration
    const validation = validateWorkflow(workflowData);
    if (!validation.valid) {
      throw new Error(`Invalid workflow configuration: ${validation.errors.join(", ")}`);
    }

    loggerService.info("Creating workflow with data", {
      orgId: workflowData.orgId,
      name: workflowData.name,
      triggerType: workflowData.trigger.type,
      stepsCount: workflowData.steps.length,
      version: workflowData.version,
    });

    // Create the workflow
    const workflowId = await workflowRepository.create(workflowData);

    loggerService.info("Workflow created successfully", {
      workflowId,
      orgId: workflowData.orgId,
      name: workflowData.name,
    });

    return workflowId;
  } catch (error: any) {
    loggerService.error("Failed to create workflow in handler", {
      error: error.message,
      stack: error.stack,
      payload: {
        orgId: payload.orgId,
        name: payload.name,
        triggerType: payload.trigger?.type,
      },
    });

    throw error;
  }
}
