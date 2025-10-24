import { Workflow, WorkflowData } from "../../entities/workflow";

export interface WorkflowRepository {
  create(data: WorkflowData): Promise<string>;
  get(id: string): Promise<Workflow | null>;
  getAll(params?: {
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
  }): Promise<Workflow[]>;
  update(id: string, data: Partial<WorkflowData>): Promise<void>;
  delete(id: string): Promise<void>;
  
  // Workflow-specific operations
  getActiveWorkflows(orgId: string): Promise<Workflow[]>;
  getWorkflowsByTrigger(triggerType: string, orgId: string): Promise<Workflow[]>;
  getN8nWorkflows(orgId: string): Promise<Workflow[]>;
  updateN8nWorkflowId(workflowId: string, n8nWorkflowId: string): Promise<void>;
}
