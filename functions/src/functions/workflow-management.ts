import { onCall } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { 
  WorkflowDefinition, 
  WorkflowVersion, 
  StepDefinition, 
  WorkflowEdge 
} from "../core/entities/workflow-execution";

const db = getFirestore();

export interface CreateWorkflowRequest {
  tenantId: string;
  name: string;
  description?: string;
  steps: StepDefinition[];
  edges: WorkflowEdge[];
  inputSchema?: Record<string, unknown>;
}

export interface UpdateWorkflowRequest {
  workflowId: string;
  tenantId: string;
  name?: string;
  description?: string;
  steps?: StepDefinition[];
  edges?: WorkflowEdge[];
  inputSchema?: Record<string, unknown>;
  active?: boolean;
}

/**
 * Create a new workflow
 */
export const createWorkflow = onCall({
  region: "us-central1",
}, async (request) => {
  try {
    const { tenantId, name, steps, edges, inputSchema } = request.data as CreateWorkflowRequest;

    if (!tenantId || !name || !steps || !edges) {
      throw new Error("Missing required fields: tenantId, name, steps, edges");
    }

    // Validate workflow structure
    validateWorkflowStructure(steps, edges);

    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create workflow definition
    const workflow: WorkflowDefinition = {
      id: workflowId,
      tenantId,
      name,
      active: true,
      latestVersion: 1,
      createdAt: FieldValue.serverTimestamp() as any,
      updatedAt: FieldValue.serverTimestamp() as any,
    };

    // Create workflow version
    const version: WorkflowVersion = {
      workflowId,
      version: 1,
      trigger: {
        type: "manual.trigger", // Default trigger for old workflow management
      },
      steps: steps.reduce((acc, step) => {
        acc[step.id] = step;
        return acc;
      }, {} as Record<string, StepDefinition>),
      edges,
      inputSchema,
      createdAt: FieldValue.serverTimestamp() as any,
    };

    // Save to Firestore
    const batch = db.batch();
    
    batch.set(db.collection("workflows").doc(workflowId), workflow);
    batch.set(db.collection("workflowVersions").doc(`${workflowId}_1`), version);
    
    await batch.commit();

    logger.info("Workflow created successfully", { workflowId, tenantId });

    return {
      success: true,
      workflowId,
      version: 1,
    };

  } catch (error) {
    logger.error("Error creating workflow", { 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
    throw error;
  }
});

/**
 * Update an existing workflow
 */
export const updateWorkflow = onCall({
  region: "us-central1",
}, async (request) => {
  try {
    const { 
      workflowId, 
      tenantId, 
      name, 
      steps, 
      edges, 
      inputSchema, 
      active 
    } = request.data as UpdateWorkflowRequest;

    if (!workflowId || !tenantId) {
      throw new Error("Missing required fields: workflowId, tenantId");
    }

    // Get existing workflow
    const workflowDoc = await db.collection("workflows").doc(workflowId).get();
    if (!workflowDoc.exists) {
      throw new Error("Workflow not found");
    }

    const existingWorkflow = workflowDoc.data() as WorkflowDefinition;
    
    // Verify tenant access
    if (existingWorkflow.tenantId !== tenantId) {
      throw new Error("Unauthorized: Workflow belongs to different tenant");
    }

    const batch = db.batch();

    // Update workflow definition
    const workflowUpdates: Partial<WorkflowDefinition> = {
      updatedAt: FieldValue.serverTimestamp() as any,
    };

    if (name !== undefined) workflowUpdates.name = name;
    if (active !== undefined) workflowUpdates.active = active;

    batch.update(db.collection("workflows").doc(workflowId), workflowUpdates);

    // If steps or edges are provided, create a new version
    if (steps && edges) {
      validateWorkflowStructure(steps, edges);
      
      const newVersion = existingWorkflow.latestVersion + 1;
      
      const version: WorkflowVersion = {
        workflowId,
        version: newVersion,
        trigger: {
          type: "manual.trigger", // Default trigger for old workflow management
        },
        steps: steps.reduce((acc, step) => {
          acc[step.id] = step;
          return acc;
        }, {} as Record<string, StepDefinition>),
        edges,
        inputSchema,
        createdAt: FieldValue.serverTimestamp() as any,
      };

      batch.set(db.collection("workflowVersions").doc(`${workflowId}_${newVersion}`), version);
      batch.update(db.collection("workflows").doc(workflowId), {
        latestVersion: newVersion,
      });
    }

    await batch.commit();

    logger.info("Workflow updated successfully", { workflowId, tenantId });

    return {
      success: true,
      workflowId,
      version: existingWorkflow.latestVersion,
    };

  } catch (error) {
    logger.error("Error updating workflow", { 
      workflowId: request.data.workflowId,
      error: error instanceof Error ? error.message : "Unknown error" 
    });
    throw error;
  }
});

/**
 * Get workflow details
 */
export const getWorkflow = onCall({
  region: "us-central1",
}, async (request) => {
  try {
    const { workflowId, tenantId } = request.data;

    if (!workflowId || !tenantId) {
      throw new Error("Missing required fields: workflowId, tenantId");
    }

    // Get workflow definition
    const workflowDoc = await db.collection("workflows").doc(workflowId).get();
    if (!workflowDoc.exists) {
      throw new Error("Workflow not found");
    }

    const workflow = workflowDoc.data() as WorkflowDefinition;
    
    // Verify tenant access
    if (workflow.tenantId !== tenantId) {
      throw new Error("Unauthorized: Workflow belongs to different tenant");
    }

    // Get latest version
    const versionDoc = await db
      .collection("workflowVersions")
      .doc(`${workflowId}_${workflow.latestVersion}`)
      .get();

    if (!versionDoc.exists) {
      throw new Error("Workflow version not found");
    }

    const version = versionDoc.data() as WorkflowVersion;

    return {
      success: true,
      workflow: {
        ...workflow,
        steps: Object.values(version.steps),
        edges: version.edges,
        inputSchema: version.inputSchema,
      },
    };

  } catch (error) {
    logger.error("Error getting workflow", { 
      workflowId: request.data.workflowId,
      error: error instanceof Error ? error.message : "Unknown error" 
    });
    throw error;
  }
});

/**
 * List workflows for a tenant
 */
export const listWorkflows = onCall({
  region: "us-central1",
}, async (request) => {
  try {
    const { tenantId } = request.data;

    if (!tenantId) {
      throw new Error("Missing required field: tenantId");
    }

    const workflowsSnapshot = await db
      .collection("workflows")
      .where("tenantId", "==", tenantId)
      .orderBy("createdAt", "desc")
      .get();

    const workflows = workflowsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      success: true,
      workflows,
    };

  } catch (error) {
    logger.error("Error listing workflows", { 
      tenantId: request.data.tenantId,
      error: error instanceof Error ? error.message : "Unknown error" 
    });
    throw error;
  }
});

/**
 * Delete a workflow
 */
export const deleteWorkflow = onCall({
  region: "us-central1",
}, async (request) => {
  try {
    const { workflowId, tenantId } = request.data;

    if (!workflowId || !tenantId) {
      throw new Error("Missing required fields: workflowId, tenantId");
    }

    // Get workflow to verify ownership
    const workflowDoc = await db.collection("workflows").doc(workflowId).get();
    if (!workflowDoc.exists) {
      throw new Error("Workflow not found");
    }

    const workflow = workflowDoc.data() as WorkflowDefinition;
    
    // Verify tenant access
    if (workflow.tenantId !== tenantId) {
      throw new Error("Unauthorized: Workflow belongs to different tenant");
    }

    // Delete workflow and all versions
    const batch = db.batch();
    
    batch.delete(db.collection("workflows").doc(workflowId));
    
    // Delete all versions
    const versionsSnapshot = await db
      .collection("workflowVersions")
      .where("workflowId", "==", workflowId)
      .get();
    
    versionsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info("Workflow deleted successfully", { workflowId, tenantId });

    return {
      success: true,
    };

  } catch (error) {
    logger.error("Error deleting workflow", { 
      workflowId: request.data.workflowId,
      error: error instanceof Error ? error.message : "Unknown error" 
    });
    throw error;
  }
});

/**
 * Validate workflow structure
 */
function validateWorkflowStructure(steps: StepDefinition[], edges: WorkflowEdge[]): void {
  if (steps.length === 0) {
    throw new Error("Workflow must have at least one step");
  }

  // Check for duplicate step IDs
  const stepIds = new Set();
  for (const step of steps) {
    if (stepIds.has(step.id)) {
      throw new Error(`Duplicate step ID: ${step.id}`);
    }
    stepIds.add(step.id);
  }

  // Validate edges reference existing steps
  for (const edge of edges) {
    if (!stepIds.has(edge.from)) {
      throw new Error(`Edge references non-existent step: ${edge.from}`);
    }
    if (!stepIds.has(edge.to)) {
      throw new Error(`Edge references non-existent step: ${edge.to}`);
    }
  }

  // Check for cycles (basic check)
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(stepId: string): boolean {
    if (recursionStack.has(stepId)) {
      return true;
    }
    if (visited.has(stepId)) {
      return false;
    }

    visited.add(stepId);
    recursionStack.add(stepId);

    const outgoingEdges = edges.filter(edge => edge.from === stepId);
    for (const edge of outgoingEdges) {
      if (hasCycle(edge.to)) {
        return true;
      }
    }

    recursionStack.delete(stepId);
    return false;
  }

  for (const step of steps) {
    if (hasCycle(step.id)) {
      throw new Error("Workflow contains cycles");
    }
  }
}
