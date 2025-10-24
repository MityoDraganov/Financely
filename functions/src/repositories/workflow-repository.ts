import { DatabaseService, Workflow, WorkflowData } from "../core";
import { getGenericRepository } from "./generic-repository";
import { DatabaseCollection } from "./config";

/**
 * Factory for a `WorkflowRepository` backed by the provided `DatabaseService`.
 *
 * @param {DatabaseService} databaseService - Abstraction over the database layer.
 * @return {WorkflowRepository} Repository with CRUD operations for workflows.
 */
export function getWorkflowRepository(
  databaseService: DatabaseService,
): any {
  const baseWorkflowRepo = getGenericRepository<Workflow, WorkflowData>(
    () => DatabaseCollection.WORKFLOWS,
    databaseService,
  );

  return {
    // Workflow CRUD operations
    async create(data: WorkflowData) {
      const workflowData = {
        ...data,
        version: data.version || 1,
        n8nEnabled: data.n8nEnabled || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      return baseWorkflowRepo.create({ data: workflowData });
    },

    async get(id: string) {
      return baseWorkflowRepo.get({ id });
    },

    async getAll(params: {
      queryConstraints?: Array<{
        field: string;
        operator: "==" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "not-in" | "array-contains" | "array-contains-any";
        value: any;
      }>;
      orderBy?: {
        field: string;
        direction: "asc" | "desc";
      };
      pagination?: {
        limit?: number;
        offset?: number;
      };
    } = {}) {
      return baseWorkflowRepo.getAll({
        queryConstraints: params.queryConstraints || [],
        orderBy: params.orderBy,
        pagination: params.pagination || {},
      });
    },

    async update(id: string, data: Partial<WorkflowData>) {
      const updateData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      
      return baseWorkflowRepo.update({ id, data: updateData });
    },

    async delete(id: string) {
      return baseWorkflowRepo.delete({ id });
    },

    // Workflow-specific operations
    async getActiveWorkflows(orgId: string) {
      return baseWorkflowRepo.getAll({
        queryConstraints: [
          { field: "orgId", operator: "==", value: orgId },
          { field: "status", operator: "==", value: "active" },
        ],
      });
    },

    async getWorkflowsByTrigger(triggerType: string, orgId: string) {
      return baseWorkflowRepo.getAll({
        queryConstraints: [
          { field: "orgId", operator: "==", value: orgId },
          { field: "status", operator: "==", value: "active" },
          { field: "trigger.type", operator: "==", value: triggerType },
        ],
      });
    },

    async getN8nWorkflows(orgId: string) {
      return baseWorkflowRepo.getAll({
        queryConstraints: [
          { field: "orgId", operator: "==", value: orgId },
          { field: "n8nEnabled", operator: "==", value: true },
        ],
      });
    },

    async updateN8nWorkflowId(workflowId: string, n8nWorkflowId: string) {
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
