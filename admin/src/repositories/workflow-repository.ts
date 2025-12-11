import { DatabaseService, Workflow, WorkflowData, WorkflowExecution, WorkflowExecutionData } from "@/core";
import { WorkflowRepository } from "@/core/ports/repositories/workflow-repository";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

/**
 * Factory for a `WorkflowRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {WorkflowRepository} Repository with CRUD operations for workflows.
 */
export function getWorkflowRepository(
  databaseService: DatabaseService,
): WorkflowRepository {
  const baseWorkflowRepo = getGenericRepository<Workflow, WorkflowData>(
    () => DatabaseCollection.WORKFLOWS,
    databaseService,
  );

  const baseExecutionRepo = getGenericRepository<WorkflowExecution, WorkflowExecutionData>(
    () => DatabaseCollection.WORKFLOW_EXECUTIONS,
    databaseService,
  );

  return {
    // Workflow CRUD operations
    async create(data) {
      const workflowData = {
        ...data,
        version: data.version || 1,
        n8nEnabled: data.n8nEnabled || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      return baseWorkflowRepo.create({ data: workflowData });
    },

    async get(id) {
      return baseWorkflowRepo.get({ id });
    },

    async getAll(params = {}) {
      return baseWorkflowRepo.getAll({
        queryConstraints: params.queryConstraints || [],
        orderBy: params.orderBy,
        pagination: params.pagination,
      });
    },

    async update(id, data) {
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      
      return baseWorkflowRepo.update({ id, data: updateData });
    },

    async delete(id) {
      return baseWorkflowRepo.delete({ id });
    },

    // Workflow execution operations
    async createExecution(workflowId, triggerData = {}) {
      const executionData = {
        workflowId,
        status: "pending" as const,
        triggerType: "manual.trigger" as const, // Default trigger type
        triggerData,
        logs: [],
      };
      
      return baseExecutionRepo.create({ data: executionData });
    },

    async getExecution(id) {
      return baseExecutionRepo.get({ id });
    },

    async getExecutions(workflowId, params = {}) {
      return baseExecutionRepo.getAll({
        queryConstraints: [{ field: "workflowId", operator: "==", value: workflowId }],
        orderBy: { field: "startedAt", direction: "desc" },
        pagination: params,
      });
    },

    async updateExecution(id, data) {
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      
      return baseExecutionRepo.update({ id, data: updateData });
    },

    async addExecutionLog(executionId, log) {
      const execution = await this.getExecution(executionId);
      if (!execution) {
        throw new Error("Execution not found");
      }

      const logEntry = {
        ...log,
        actionType: log.actionType as "http_request" | "send.email",
        timestamp: new Date().toISOString(),
      };

      const updatedLogs = [...execution.logs, logEntry];
      
      return baseExecutionRepo.update({ id: executionId, data: { logs: updatedLogs } });
    },

    async getActiveWorkflows(orgId) {
      return baseWorkflowRepo.getAll({
        queryConstraints: [
          { field: "orgId", operator: "==", value: orgId },
          { field: "status", operator: "==", value: "active" },
        ],
      });
    },

    async getWorkflowsByTrigger(triggerType, orgId) {
      return baseWorkflowRepo.getAll({
        queryConstraints: [
          { field: "orgId", operator: "==", value: orgId },
          { field: "status", operator: "==", value: "active" },
          { field: "trigger.type", operator: "==", value: triggerType },
        ],
      });
    },

    async getN8nWorkflows(orgId) {
      return baseWorkflowRepo.getAll({
        queryConstraints: [
          { field: "orgId", operator: "==", value: orgId },
          { field: "n8nEnabled", operator: "==", value: true },
        ],
      });
    },

    async updateN8nWorkflowId(workflowId, n8nWorkflowId) {
      return baseWorkflowRepo.update({ 
        id: workflowId, 
        data: { 
          n8nWorkflowId,
          n8nEnabled: true,
        } 
      });
    },
  };
}
