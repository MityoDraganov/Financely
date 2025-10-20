import { Workflow, WorkflowExecution, CreateWorkflowInput, UpdateWorkflowInput, WorkflowTriggerType } from "../../entities/workflow";
import { DatabaseService, QueryConstraint, PaginationOptions, OrderByOptions } from "../services/database-service";

export interface WorkflowRepository {
  // Workflow CRUD operations
  create(data: CreateWorkflowInput): Promise<string>;
  get(id: string): Promise<Workflow | null>;
  getAll(params?: {
    queryConstraints?: QueryConstraint[];
    orderBy?: OrderByOptions;
    pagination?: PaginationOptions;
  }): Promise<Workflow[]>;
  update(id: string, data: UpdateWorkflowInput): Promise<void>;
  delete(id: string): Promise<void>;
  
  // Workflow execution operations
  createExecution(workflowId: string, triggerData?: Record<string, unknown>): Promise<string>;
  getExecution(id: string): Promise<WorkflowExecution | null>;
  getExecutions(workflowId: string, params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<WorkflowExecution[]>;
  updateExecution(id: string, data: Partial<WorkflowExecution>): Promise<void>;
  addExecutionLog(executionId: string, log: {
    stepId: string;
    actionType: string;
    status: "started" | "completed" | "failed";
    message?: string;
    error?: string;
    data?: Record<string, unknown>;
  }): Promise<void>;
  
  // Workflow status operations
  getActiveWorkflows(orgId: string): Promise<Workflow[]>;
  getWorkflowsByTrigger(triggerType: WorkflowTriggerType, orgId: string): Promise<Workflow[]>;
  
  // n8n integration
  getN8nWorkflows(orgId: string): Promise<Workflow[]>;
  updateN8nWorkflowId(workflowId: string, n8nWorkflowId: string): Promise<void>;
}

export function getWorkflowRepository(databaseService: DatabaseService): WorkflowRepository {
  return {
    async create(data) {
      const workflowData = {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      return databaseService.create("workflows", workflowData);
    },

    async get(id) {
      return databaseService.get("workflows", id);
    },

    async getAll(params = {}) {
      return databaseService.getPaginated("workflows", 
        params.queryConstraints || [], 
        params.pagination || {}, 
        params.orderBy
      );
    },

    async update(id, data) {
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      
      return databaseService.update("workflows", id, updateData);
    },

    async delete(id) {
      return databaseService.delete("workflows", id);
    },

    async createExecution(workflowId, triggerData = {}) {
      const executionData = {
        workflowId,
        status: "pending",
        triggerData,
        startedAt: new Date().toISOString(),
        logs: [],
      };
      
      return databaseService.create("workflow_executions", executionData);
    },

    async getExecution(id) {
      return databaseService.get("workflow_executions", id);
    },

    async getExecutions(workflowId, params = {}) {
      return databaseService.getPaginated("workflow_executions", 
        [{ field: "workflowId", operator: "==", value: workflowId }],
        params,
        { field: "startedAt", direction: "desc" }
      );
    },

    async updateExecution(id, data) {
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      
      return databaseService.update("workflow_executions", id, updateData);
    },

    async addExecutionLog(executionId, log) {
      const execution = await this.getExecution(executionId);
      if (!execution) {
        throw new Error("Execution not found");
      }

      const logEntry = {
        ...log,
        timestamp: new Date().toISOString(),
      };

      const updatedLogs = [...execution.logs, logEntry];
      
      return databaseService.update("workflow_executions", executionId, {
        logs: updatedLogs,
      });
    },

    async getActiveWorkflows(orgId) {
      return databaseService.getPaginated("workflows", 
        [
          { field: "orgId", operator: "==", value: orgId },
          { field: "status", operator: "==", value: "active" },
        ],
        {}
      );
    },

    async getWorkflowsByTrigger(triggerType, orgId) {
      return databaseService.getPaginated("workflows", 
        [
          { field: "orgId", operator: "==", value: orgId },
          { field: "status", operator: "==", value: "active" },
          { field: "trigger.type", operator: "==", value: triggerType },
        ],
        {}
      );
    },

    async getN8nWorkflows(orgId) {
      return databaseService.getPaginated("workflows", 
        [
          { field: "orgId", operator: "==", value: orgId },
          { field: "n8nEnabled", operator: "==", value: true },
        ],
        {}
      );
    },

    async updateN8nWorkflowId(workflowId, n8nWorkflowId) {
      return databaseService.update("workflows", workflowId, {
        n8nWorkflowId,
        n8nEnabled: true,
      });
    },
  };
}
