import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { v4 as uuidv4 } from "uuid";
import { firestore as db } from "../infrastructure/firebase";
import {
  WorkflowRun,
  StepExecution,
  WorkflowEvent,
  StepDefinition,
} from "../core/entities/workflow-execution";

/**
 * Remove undefined values from an object recursively
 * Firestore doesn't allow undefined values
 */
function removeUndefinedValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedValues(value);
      }
    }
    return cleaned;
  }
  
  return obj;
}

export class WorkflowExecutionEngine {
  private actionExecutors: Map<string, any> = new Map();

  /**
   * Register an action executor
   */
  registerExecutor(type: string, executor: any): void {
    this.actionExecutors.set(type, executor);
  }

  /**
   * Process a workflow event and trigger matching workflows
   */
  async processEvent(event: WorkflowEvent): Promise<void> {
    try {
      logger.info("Processing workflow event", { 
        eventId: event.eventId, 
        type: event.type,
        tenantId: event.tenantId,
        payloadKeys: Object.keys(event.payload || {})
      });

      // Find active workflows that match this trigger
      const workflows = await this.findMatchingWorkflows(event.tenantId, event.type);
      
      logger.info("Workflow search completed", {
        eventId: event.eventId,
        type: event.type,
        tenantId: event.tenantId,
        workflowsFound: workflows.length,
        workflowIds: workflows.map((w: any) => w.id)
      });
      
      if (workflows.length === 0) {
        logger.info("No matching workflows found", { 
          eventId: event.eventId, 
          type: event.type,
          tenantId: event.tenantId,
          message: "No active workflows found with this trigger type for this organization"
        });
        return;
      }

      // Create workflow runs for each matching workflow
      const runPromises = workflows.map(workflow => 
        this.createWorkflowRun(workflow, event)
      );

      await Promise.all(runPromises);
      
      logger.info("Created workflow runs", { 
        eventId: event.eventId, 
        workflowCount: workflows.length,
        runIds: await Promise.all(runPromises.map(async () => {
          // We can't easily get runIds here, but we log them in createWorkflowRun
          return "created";
        }))
      });
    } catch (error) {
      logger.error("Error processing workflow event", { 
        eventId: event.eventId,
        type: event.type,
        tenantId: event.tenantId,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Find workflows that match the given trigger type
   */
  private async findMatchingWorkflows(tenantId: string, triggerType: string): Promise<any[]> {
    logger.info("Searching for matching workflows", {
      tenantId,
      triggerType
    });

    // First, let's check what workflows exist for this org (for debugging)
    const allWorkflowsSnapshot = await db
      .collection("workflows")
      .where("orgId", "==", tenantId)
      .get();

    logger.info("All workflows for organization", {
      tenantId,
      totalWorkflows: allWorkflowsSnapshot.size,
      workflows: allWorkflowsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        status: doc.data().status,
        triggerType: doc.data().trigger?.type,
        orgId: doc.data().orgId
      }))
    });

    // Use the new workflow structure - look for workflows with matching trigger type
    const workflowsSnapshot = await db
      .collection("workflows")
      .where("orgId", "==", tenantId)
      .where("status", "==", "active")
      .where("trigger.type", "==", triggerType)
      .get();

    logger.info("Workflow query executed", {
      tenantId,
      triggerType,
      totalDocs: workflowsSnapshot.size,
      queryConditions: {
        orgId: tenantId,
        status: "active",
        "trigger.type": triggerType
      }
    });

    const matchingWorkflows: any[] = [];

    for (const workflowDoc of workflowsSnapshot.docs) {
      const workflow = workflowDoc.data();
      // Add the document ID to the workflow object
      workflow.id = workflowDoc.id;
      matchingWorkflows.push(workflow);
      
      logger.info("Found matching workflow", {
        workflowId: workflowDoc.id,
        workflowName: workflow.name,
        triggerType: workflow.trigger?.type,
        status: workflow.status,
        stepCount: workflow.steps?.length || 0
      });
    }

    logger.info("Found matching workflows", { 
      tenantId, 
      triggerType, 
      count: matchingWorkflows.length,
      workflowIds: matchingWorkflows.map(w => w.id)
    });

    return matchingWorkflows;
  }


  /**
   * Create a new workflow run
   */
  private async createWorkflowRun(workflow: any, event: WorkflowEvent): Promise<void> {
    const runId = uuidv4();

    // Validate workflow has required fields
    if (!workflow.id) {
      throw new Error(`Workflow missing ID: ${JSON.stringify(workflow)}`);
    }
    if (!workflow.orgId) {
      throw new Error(`Workflow missing orgId: ${JSON.stringify(workflow)}`);
    }

    logger.info("Creating workflow run", {
      runId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      tenantId: workflow.orgId,
      eventType: event.type,
    });

    // Create the workflow execution in the format expected by frontend
    const execution = {
      id: runId,
      workflowId: workflow.id,
      status: "pending" as const,
      triggerType: event.type as any,
      triggerData: event.payload,
      startedAt: new Date().toISOString(),
      logs: [],
      context: { ...event.payload }, // Start with event payload as context
    };

    await db.collection("workflowRuns").doc(runId).set(execution);

    logger.info("Workflow run created successfully", { runId, workflowId: workflow.id });

    // Create initial step executions
    await this.createInitialStepExecutions(runId, workflow);

    // Start the workflow execution
    await this.startWorkflowExecution(runId);
  }

  /**
   * Create initial step executions for the workflow run
   */
  private async createInitialStepExecutions(runId: string, workflow: any): Promise<void> {
    const batch = db.batch();

    // Find the first step (entry point) - in the new structure, steps are in workflow.steps array
    const firstStep = workflow.steps && workflow.steps.length > 0 ? workflow.steps[0] : null;
    
    if (firstStep) {
      const stepExecution: StepExecution = {
        stepId: firstStep.id,
        type: firstStep.type,
        status: "pending",
        attempt: 1,
        rev: 1,
        next: this.getNextStepsFromWorkflow(firstStep.id, workflow),
        createdAt: FieldValue.serverTimestamp() as any,
        updatedAt: FieldValue.serverTimestamp() as any,
      };

      batch.set(
        db.collection("workflowRuns").doc(runId).collection("steps").doc(firstStep.id),
        stepExecution
      );
    }

    await batch.commit();
  }

  /**
   * Get next steps from workflow (new structure)
   */
  private getNextStepsFromWorkflow(currentStepId: string, workflow: any): string[] {
    if (!workflow.steps) return [];
    
    const currentStepIndex = workflow.steps.findIndex((step: any) => step.id === currentStepId);
    if (currentStepIndex === -1 || currentStepIndex >= workflow.steps.length - 1) {
      return []; // No next steps
    }
    
    // Return the next step ID
    return [workflow.steps[currentStepIndex + 1].id];
  }


  /**
   * Start workflow execution by processing the first queued step
   */
  private async startWorkflowExecution(runId: string): Promise<void> {
    // Update workflow execution status
    await db.collection("workflowRuns").doc(runId).update({
      status: "running",
    });

    // Process the first queued step
    await this.processNextStep(runId);
  }

  /**
   * Process the next queued step in the workflow run
   */
  async processNextStep(runId: string): Promise<void> {
    try {
      // Find the next queued step
      const stepsSnapshot = await db
        .collection("workflowRuns")
        .doc(runId)
        .collection("steps")
        .where("status", "==", "pending")
        .limit(1)
        .get();

      if (stepsSnapshot.empty) {
        // No more steps to process, check if workflow is complete
        await this.checkWorkflowCompletion(runId);
        return;
      }

      const stepDoc = stepsSnapshot.docs[0];
      const stepExecution = stepDoc.data() as StepExecution;

      // Get workflow run and workflow definition
      const runDoc = await db.collection("workflowRuns").doc(runId).get();
      const run = runDoc.data() as WorkflowRun;

      const workflowDoc = await db.collection("workflows").doc(run.workflowId).get();
      const workflow = workflowDoc.data();

      if (!workflow) {
        throw new Error(`Workflow not found: ${run.workflowId}`);
      }

      // Find the step definition in the workflow
      const stepDefinition = workflow.steps.find((step: any) => step.id === stepExecution.stepId);

      if (!stepDefinition) {
        throw new Error(`Step definition not found: ${stepExecution.stepId}`);
      }

      // Execute the step
      await this.executeStep(runId, stepExecution, stepDefinition, run.context);
    } catch (error) {
      logger.error("Error processing next step", { 
        runId, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      
      // Mark workflow as failed
      await db.collection("workflowRuns").doc(runId).update({
        status: "failed",
        endedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    runId: string,
    stepExecution: StepExecution,
    stepDefinition: StepDefinition,
    context: Record<string, unknown>
  ): Promise<void> {
    const stepId = stepExecution.stepId;
    
    try {
      logger.info("Executing step", { runId, stepId, type: stepDefinition.type });

      // Update step status to running
      await db.collection("workflowRuns").doc(runId).collection("steps").doc(stepId).update({
        status: "running",
        startedAt: FieldValue.serverTimestamp(),
        rev: FieldValue.increment(1),
      });

      // Execute each action in the step
      const results: Record<string, unknown> = {};
      const actions = (stepDefinition as any).actions || [];
      
      logger.info("Executing step actions", {
        runId,
        stepId,
        actionCount: actions.length,
        actionTypes: actions.map((a: any) => a.type)
      });
      
      for (const action of actions) {
        logger.info("Executing action", {
          runId,
          stepId,
          actionType: action.type,
          actionId: action.id,
          hasConfig: !!action.config,
          configKeys: action.config ? Object.keys(action.config) : [],
          actionStructure: JSON.stringify({
            id: action.id,
            type: action.type,
            name: action.name,
            configKeys: action.config ? Object.keys(action.config) : []
          })
        });

        const executor = this.actionExecutors.get(action.type);
        if (!executor) {
          logger.error("No executor found for action type", {
            runId,
            stepId,
            actionType: action.type,
            availableTypes: Array.from(this.actionExecutors.keys())
          });
          throw new Error(`No executor found for action type: ${action.type}`);
        }

        logger.info("Found executor for action", {
          runId,
          stepId,
          actionType: action.type,
          executorType: executor.type
        });

        // Execute the action
        try {
          const actionResult = await executor.execute(action, context, runId);
          results[action.id] = actionResult;
          
          logger.info("Action executed successfully", {
            runId,
            stepId,
            actionType: action.type,
            actionId: action.id
          });
        } catch (error) {
          logger.error("Error executing action", {
            runId,
            stepId,
            actionType: action.type,
            actionId: action.id,
            error: error instanceof Error ? error.message : "Unknown error",
            actionConfig: JSON.stringify(action.config, null, 2)
          });
          throw error;
        }
      }

      // Clean results to remove undefined values before saving to Firestore
      const cleanedResults = removeUndefinedValues(results);

      // Update step status to completed
      await db.collection("workflowRuns").doc(runId).collection("steps").doc(stepId).update({
        status: "completed",
        endedAt: FieldValue.serverTimestamp(),
        result: cleanedResults,
        rev: FieldValue.increment(1),
      });

      // Add execution log
      const logEntry = {
        stepId,
        actionType: stepDefinition.type,
        status: "completed" as const,
        message: `Step ${stepDefinition.name || stepId} completed successfully`,
        timestamp: new Date().toISOString(),
        data: cleanedResults,
      };

      // Update workflow execution with log and context
      await db.collection("workflowRuns").doc(runId).update({
        context: {
          ...context,
          [stepId]: cleanedResults,
        },
        logs: FieldValue.arrayUnion(logEntry),
      });

      // Process next steps
      for (const nextStepId of stepExecution.next) {
        await this.createStepExecution(runId, nextStepId, stepDefinition.type);
      }

      // Continue processing
      await this.processNextStep(runId);

    } catch (error) {
      logger.error("Error executing step", { 
        runId, 
        stepId, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });

      // Update step status to failed
      await db.collection("workflowRuns").doc(runId).collection("steps").doc(stepId).update({
        status: "failed",
        endedAt: FieldValue.serverTimestamp(),
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
        },
        rev: FieldValue.increment(1),
      });

      // Add error log to workflow execution
      const errorLogEntry = {
        stepId,
        actionType: stepDefinition.type,
        status: "failed" as const,
        message: `Step ${stepDefinition.name || stepId} failed`,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };

      // Mark workflow as failed with error log
      await db.collection("workflowRuns").doc(runId).update({
        status: "failed",
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        logs: FieldValue.arrayUnion(errorLogEntry),
      });
    }
  }

  /**
   * Create a step execution for the next step
   */
  private async createStepExecution(runId: string, stepId: string, previousStepType: string): Promise<void> {
    // Get workflow run and workflow definition
    const runDoc = await db.collection("workflowRuns").doc(runId).get();
    const run = runDoc.data() as WorkflowRun;

    const workflowDoc = await db.collection("workflows").doc(run.workflowId).get();
    const workflow = workflowDoc.data();

    if (!workflow) {
      throw new Error(`Workflow not found: ${run.workflowId}`);
    }

    // Find the step definition in the workflow
    const stepDefinition = workflow.steps.find((step: any) => step.id === stepId);

    if (!stepDefinition) {
      logger.warn("Step definition not found", { runId, stepId });
      return;
    }

    const stepExecution: StepExecution = {
      stepId,
      type: stepDefinition.type,
      status: "pending",
      attempt: 1,
      rev: 1,
      next: this.getNextStepsFromWorkflow(stepId, workflow),
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any,
    };

    await db.collection("workflowRuns").doc(runId).collection("steps").doc(stepId).set(stepExecution);
  }

  /**
   * Check if workflow execution is complete
   */
  private async checkWorkflowCompletion(runId: string): Promise<void> {
    // Check if all steps are completed
    const stepsSnapshot = await db
      .collection("workflowRuns")
      .doc(runId)
      .collection("steps")
      .get();

    const allStepsCompleted = stepsSnapshot.docs.every(doc => {
      const step = doc.data() as StepExecution;
      return step.status === "completed" || step.status === "failed";
    });

    if (allStepsCompleted) {
      // Check if any steps failed
      const hasFailures = stepsSnapshot.docs.some(doc => {
        const step = doc.data() as StepExecution;
        return step.status === "failed";
      });

      const finalStatus = hasFailures ? "failed" : "completed";

      await db.collection("workflowRuns").doc(runId).update({
        status: finalStatus,
        completedAt: new Date().toISOString(),
      });

      logger.info("Workflow execution completed", { runId, status: finalStatus });
    }
  }
}