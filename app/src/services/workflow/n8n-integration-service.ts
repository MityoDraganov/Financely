import { Workflow, WorkflowTrigger, WorkflowStep } from "@/core";

/**
 * n8n Integration Service
 * Handles synchronization between Financely workflows and n8n workflows
 */
export class N8nIntegrationService {
  private static instance: N8nIntegrationService;
  private n8nBaseUrl: string;
  private n8nApiKey: string;

  private constructor() {
    this.n8nBaseUrl = process.env.VITE_N8N_BASE_URL || "http://localhost:5678";
    this.n8nApiKey = process.env.VITE_N8N_API_KEY || "";
  }

  public static getInstance(): N8nIntegrationService {
    if (!N8nIntegrationService.instance) {
      N8nIntegrationService.instance = new N8nIntegrationService();
    }
    return N8nIntegrationService.instance;
  }

  /**
   * Convert Financely workflow to n8n workflow format
   */
  public convertToN8nWorkflow(workflow: Workflow): any {
    const n8nWorkflow = {
      name: workflow.name,
      active: workflow.status === "active",
      nodes: this.convertStepsToN8nNodes(workflow.steps, workflow.trigger),
      connections: this.generateN8nConnections(workflow.steps),
      settings: {
        executionOrder: "v1",
        saveManualExecutions: true,
        callerPolicy: "workflowsFromSameOwner",
        errorWorkflow: null,
      },
      staticData: null,
      tags: workflow.tags,
      meta: {
        templateCredsSetupCompleted: true,
        instanceId: "financely",
      },
    };

    return n8nWorkflow;
  }

  /**
   * Convert workflow steps to n8n nodes
   */
  private convertStepsToN8nNodes(steps: WorkflowStep[], trigger: WorkflowTrigger): any[] {
    const nodes: any[] = [];

    // Add trigger node
    const triggerNode = this.createTriggerNode(trigger);
    nodes.push(triggerNode);

    // Add step nodes
    steps.forEach((step, index) => {
      const stepNodes = this.convertStepToN8nNodes(step, index);
      nodes.push(...stepNodes);
    });

    return nodes;
  }

  /**
   * Create n8n trigger node based on workflow trigger
   */
  private createTriggerNode(trigger: WorkflowTrigger): any {
    const baseNode = {
      id: "trigger-node",
      name: "Trigger",
      type: "n8n-nodes-base.start",
      typeVersion: 1,
      position: [240, 300],
      parameters: {},
    };

    switch (trigger.type) {
      case "schedule.cron":
        return {
          ...baseNode,
          type: "n8n-nodes-base.cron",
          parameters: {
            rule: {
              interval: [{ field: "cronExpression", expression: trigger.cronExpression || "0 9 * * *" }],
            },
          },
        };

      case "webhook.external":
        return {
          ...baseNode,
          type: "n8n-nodes-base.webhook",
          parameters: {
            httpMethod: "POST",
            path: `/webhook/${trigger.webhookUrl?.split("/").pop() || "financely"}`,
            responseMode: "responseNode",
          },
        };

      case "manual.trigger":
        return {
          ...baseNode,
          type: "n8n-nodes-base.manualTrigger",
          parameters: {},
        };

      default:
        // For event-based triggers, we'll use a webhook that gets called by our system
        return {
          ...baseNode,
          type: "n8n-nodes-base.webhook",
          parameters: {
            httpMethod: "POST",
            path: `/webhook/${trigger.type.replace(".", "-")}`,
            responseMode: "responseNode",
          },
        };
    }
  }

  /**
   * Convert a workflow step to n8n nodes
   */
  private convertStepToN8nNodes(step: WorkflowStep, stepIndex: number): any[] {
    const nodes: any[] = [];

    step.actions.forEach((action, actionIndex) => {
      const nodeId = `step-${stepIndex}-action-${actionIndex}`;
      const node = this.convertActionToN8nNode(action, nodeId, stepIndex, actionIndex);
      nodes.push(node);
    });

    return nodes;
  }

  /**
   * Convert a workflow action to n8n node
   */
  private convertActionToN8nNode(action: any, nodeId: string, stepIndex: number, actionIndex: number): any {
    const baseNode = {
      id: nodeId,
      name: `${action.type.replace(".", " ").replace(/\b\w/g, l => l.toUpperCase())}`,
      position: [400 + (stepIndex * 200), 200 + (actionIndex * 100)],
      parameters: {},
    };

    switch (action.type) {
      case "send.email":
        return {
          ...baseNode,
          type: "n8n-nodes-base.emailSend",
          parameters: {
            fromEmail: "{{$env.FINANCELY_FROM_EMAIL}}",
            toEmail: action.recipient || "{{$json.buyer.email}}",
            subject: action.subject || "{{$json.invoiceNumber}}",
            message: "{{$json}}",
            options: {
              attachments: [],
            },
          },
        };

      case "send.slack":
        return {
          ...baseNode,
          type: "n8n-nodes-base.slack",
          parameters: {
            resource: "message",
            operation: "post",
            channel: action.config.channel || "#general",
            text: action.config.message || "Workflow executed",
          },
        };

      case "create.invoice":
        return {
          ...baseNode,
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            url: "{{$env.FINANCELY_API_URL}}/api/invoices",
            method: "POST",
            headers: {
              Authorization: "Bearer {{$env.FINANCELY_API_KEY}}",
              "Content-Type": "application/json",
            },
            body: "={{JSON.stringify($json)}}",
          },
        };

      case "update.invoice.status":
        return {
          ...baseNode,
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            url: "{{$env.FINANCELY_API_URL}}/api/invoices/{{$json.id}}",
            method: "PATCH",
            headers: {
              Authorization: "Bearer {{$env.FINANCELY_API_KEY}}",
              "Content-Type": "application/json",
            },
            body: `={"status": "${action.config.status || "paid"}"}`,
          },
        };

      case "wait.delay":
        return {
          ...baseNode,
          type: "n8n-nodes-base.wait",
          parameters: {
            amount: action.delaySeconds || 0,
            unit: "seconds",
          },
        };

      case "call.webhook":
        return {
          ...baseNode,
          type: "n8n-nodes-base.httpRequest",
          parameters: {
            url: action.url || "{{$json.webhookUrl}}",
            method: action.method || "POST",
            headers: action.headers || {},
            body: "={{JSON.stringify($json)}}",
          },
        };

      default:
        return {
          ...baseNode,
          type: "n8n-nodes-base.noOp",
          parameters: {},
        };
    }
  }

  /**
   * Generate n8n connections between nodes
   */
  private generateN8nConnections(steps: WorkflowStep[]): any {
    const connections: any = {};

    // Connect trigger to first step
    if (steps.length > 0) {
      connections["trigger-node"] = {
        main: [
          [
            {
              node: `step-0-action-0`,
              type: "main",
              index: 0,
            },
          ],
        ],
      };
    }

    // Connect steps in sequence
    steps.forEach((step, stepIndex) => {
      step.actions.forEach((action, actionIndex) => {
        const currentNodeId = `step-${stepIndex}-action-${actionIndex}`;
        
        // Connect to next action in same step
        if (actionIndex < step.actions.length - 1) {
          connections[currentNodeId] = {
            main: [
              [
                {
                  node: `step-${stepIndex}-action-${actionIndex + 1}`,
                  type: "main",
                  index: 0,
                },
              ],
            ],
          };
        }
        // Connect to next step
        else if (stepIndex < steps.length - 1) {
          connections[currentNodeId] = {
            main: [
              [
                {
                  node: `step-${stepIndex + 1}-action-0`,
                  type: "main",
                  index: 0,
                },
              ],
            ],
          };
        }
      });
    });

    return connections;
  }

  /**
   * Create workflow in n8n
   */
  public async createN8nWorkflow(workflow: Workflow): Promise<string> {
    try {
      const n8nWorkflow = this.convertToN8nWorkflow(workflow);
      
      const response = await fetch(`${this.n8nBaseUrl}/api/v1/workflows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-N8N-API-KEY": this.n8nApiKey,
        },
        body: JSON.stringify(n8nWorkflow),
      });

      if (!response.ok) {
        throw new Error(`Failed to create n8n workflow: ${response.statusText}`);
      }

      const result = await response.json();
      return result.id;
    } catch (error) {
      console.error("Error creating n8n workflow:", error);
      throw error;
    }
  }

  /**
   * Update workflow in n8n
   */
  public async updateN8nWorkflow(workflowId: string, workflow: Workflow): Promise<void> {
    try {
      const n8nWorkflow = this.convertToN8nWorkflow(workflow);
      
      const response = await fetch(`${this.n8nBaseUrl}/api/v1/workflows/${workflowId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-N8N-API-KEY": this.n8nApiKey,
        },
        body: JSON.stringify(n8nWorkflow),
      });

      if (!response.ok) {
        throw new Error(`Failed to update n8n workflow: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error updating n8n workflow:", error);
      throw error;
    }
  }

  /**
   * Delete workflow from n8n
   */
  public async deleteN8nWorkflow(workflowId: string): Promise<void> {
    try {
      const response = await fetch(`${this.n8nBaseUrl}/api/v1/workflows/${workflowId}`, {
        method: "DELETE",
        headers: {
          "X-N8N-API-KEY": this.n8nApiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete n8n workflow: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error deleting n8n workflow:", error);
      throw error;
    }
  }

  /**
   * Execute workflow in n8n
   */
  public async executeN8nWorkflow(workflowId: string, data?: any): Promise<string> {
    try {
      const response = await fetch(`${this.n8nBaseUrl}/api/v1/workflows/${workflowId}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-N8N-API-KEY": this.n8nApiKey,
        },
        body: JSON.stringify(data || {}),
      });

      if (!response.ok) {
        throw new Error(`Failed to execute n8n workflow: ${response.statusText}`);
      }

      const result = await response.json();
      return result.executionId;
    } catch (error) {
      console.error("Error executing n8n workflow:", error);
      throw error;
    }
  }

  /**
   * Get workflow execution status from n8n
   */
  public async getN8nExecutionStatus(executionId: string): Promise<any> {
    try {
      const response = await fetch(`${this.n8nBaseUrl}/api/v1/executions/${executionId}`, {
        headers: {
          "X-N8N-API-KEY": this.n8nApiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get n8n execution status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting n8n execution status:", error);
      throw error;
    }
  }

  /**
   * Test n8n connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.n8nBaseUrl}/api/v1/workflows`, {
        headers: {
          "X-N8N-API-KEY": this.n8nApiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Error testing n8n connection:", error);
      return false;
    }
  }
}

// Export singleton instance
export const n8nIntegrationService = N8nIntegrationService.getInstance();
