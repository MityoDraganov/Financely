import { 
  Workflow, 
  WorkflowExecution, 
  CreateWorkflowInput, 
  UpdateWorkflowInput,
  WorkflowTriggerType,
  validateWorkflow,
  isWorkflowActive
} from "@/core";
import { repositoryHost } from "@/repositories";
import { databaseService } from "../database/database-service";
import { workflowExecutionEngine } from "./workflow-execution-engine";

const workflowRepository = repositoryHost.getWorkflowsRepository(databaseService);

export type WorkflowService = {
  // Workflow CRUD operations
  createWorkflow: (data: CreateWorkflowInput) => Promise<string>;
  getWorkflow: (id: string) => Promise<Workflow | null>;
  listWorkflows: (orgId: string) => Promise<Workflow[]>;
  updateWorkflow: (id: string, data: UpdateWorkflowInput) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  
  // Workflow execution
  executeWorkflow: (workflowId: string, triggerData?: Record<string, unknown>) => Promise<string>;
  getExecution: (id: string) => Promise<WorkflowExecution | null>;
  listExecutions: (workflowId: string, params?: { limit?: number; offset?: number; status?: string }) => Promise<WorkflowExecution[]>;
  
  // Workflow management
  activateWorkflow: (id: string) => Promise<void>;
  pauseWorkflow: (id: string) => Promise<void>;
  archiveWorkflow: (id: string) => Promise<void>;
  
  // Trigger handling
  handleTrigger: (triggerType: WorkflowTriggerType, triggerData: Record<string, unknown>, orgId: string) => Promise<void>;
  
  // n8n integration
  syncWithN8n: (workflowId: string) => Promise<void>;
  getN8nWorkflows: (orgId: string) => Promise<Workflow[]>;
};

export const workflowService: WorkflowService = {
  async createWorkflow(data) {
    // Ensure version and n8nEnabled are set
    const workflowData = {
      ...data,
      version: data.version || 1,
      n8nEnabled: data.n8nEnabled || false,
    };

    // Validate workflow configuration
    const validation = validateWorkflow(workflowData);
    if (!validation.valid) {
      throw new Error(`Invalid workflow configuration: ${validation.errors.join(", ")}`);
    }

    return workflowRepository.create(workflowData);
  },

  async getWorkflow(id) {
    return workflowRepository.get(id);
  },

  async listWorkflows(orgId) {
    return workflowRepository.getAll({
      queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
      orderBy: { field: "createdAt", direction: "desc" },
    });
  },

  async updateWorkflow(id, data) {
    // If updating workflow configuration, validate it
    if (data.trigger || data.steps) {
      const currentWorkflow = await workflowRepository.get(id);
      if (!currentWorkflow) {
        throw new Error("Workflow not found");
      }

      const updatedData = { ...currentWorkflow, ...data };
      const validation = validateWorkflow(updatedData);
      if (!validation.valid) {
        throw new Error(`Invalid workflow configuration: ${validation.errors.join(", ")}`);
      }
    }

    return workflowRepository.update(id, data);
  },

  async deleteWorkflow(id) {
    return workflowRepository.delete(id);
  },

  async executeWorkflow(workflowId, triggerData = {}) {
    const workflow = await workflowRepository.get(workflowId);
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (!isWorkflowActive(workflow)) {
      throw new Error("Workflow is not active");
    }

    // Use the execution engine to run the workflow
    return workflowExecutionEngine.executeWorkflow(workflowId, triggerData);
  },

  async getExecution(id) {
    return workflowRepository.getExecution(id);
  },

  async listExecutions(workflowId, params = {}) {
    return workflowRepository.getExecutions(workflowId, params);
  },

  async activateWorkflow(id) {
    const workflow = await workflowRepository.get(id);
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    // Validate workflow before activation
    const validation = validateWorkflow(workflow);
    if (!validation.valid) {
      throw new Error(`Cannot activate workflow: ${validation.errors.join(", ")}`);
    }

    return workflowRepository.update(id, { status: "active" });
  },

  async pauseWorkflow(id) {
    return workflowRepository.update(id, { status: "paused" });
  },

  async archiveWorkflow(id) {
    return workflowRepository.update(id, { status: "archived" });
  },

  async handleTrigger(triggerType, triggerData, orgId) {
    // Get all active workflows that match this trigger
    const workflows = await workflowRepository.getWorkflowsByTrigger(triggerType, orgId);
    
    // Execute each matching workflow
    for (const workflow of workflows) {
      try {
        await this.executeWorkflow(workflow.id, triggerData);
      } catch (error) {
        console.error(`Failed to execute workflow ${workflow.id}:`, error);
        // Continue with other workflows even if one fails
      }
    }
  },

  async syncWithN8n(workflowId) {
    const workflow = await workflowRepository.get(workflowId);
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    // This would integrate with n8n API to create/update the workflow
    // For now, we'll just mark it as n8n enabled
    return workflowRepository.updateN8nWorkflowId(workflowId, `n8n-${workflowId}`);
  },

  async getN8nWorkflows(orgId) {
    return workflowRepository.getN8nWorkflows(orgId);
  },
};
