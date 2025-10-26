import { Workflow, WorkflowExecution, WorkflowTriggerType } from "@/core";
import { workflowExecutionEngine } from "./workflow-execution-engine";
import { workflowTriggerIntegration } from "./workflow-trigger-integration";
import { loggerService } from "./logger-service";

export interface WorkflowTestResult {
  success: boolean;
  executionId?: string;
  error?: string;
  duration?: number;
  logs?: Array<{
    stepId: string;
    actionType: string;
    status: "started" | "completed" | "failed";
    message?: string;
    error?: string;
    timestamp: string;
  }>;
}

export interface WorkflowTestingService {
  testWorkflow: (workflowId: string, testData?: Record<string, unknown>) => Promise<WorkflowTestResult>;
  testWorkflowWithTrigger: (workflowId: string, triggerType: WorkflowTriggerType, testData?: Record<string, unknown>) => Promise<WorkflowTestResult>;
  validateWorkflow: (workflow: Workflow) => { valid: boolean; errors: string[] };
  generateTestData: (triggerType: WorkflowTriggerType) => Record<string, unknown>;
}

export const workflowTestingService: WorkflowTestingService = {
  async testWorkflow(workflowId: string, testData: Record<string, unknown> = {}): Promise<WorkflowTestResult> {
    const startTime = Date.now();
    
    try {
      loggerService.info("Testing workflow", { workflowId, testData });
      
      // Execute the workflow with test data
      const executionId = await workflowExecutionEngine.executeWorkflow(workflowId, testData);
      
      // Wait a bit for execution to complete (in a real implementation, you'd poll the execution status)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const duration = Date.now() - startTime;
      
      loggerService.info("Workflow test completed", { workflowId, executionId, duration });
      
      return {
        success: true,
        executionId,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      loggerService.error("Workflow test failed", {
        workflowId,
        error: error.message,
        duration,
      });
      
      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  },

  async testWorkflowWithTrigger(
    workflowId: string, 
    triggerType: WorkflowTriggerType, 
    testData: Record<string, unknown> = {}
  ): Promise<WorkflowTestResult> {
    const startTime = Date.now();
    
    try {
      loggerService.info("Testing workflow with trigger", { workflowId, triggerType, testData });
      
      // Generate test data if not provided
      const finalTestData = Object.keys(testData).length > 0 ? testData : this.generateTestData(triggerType);
      
      // Trigger the workflow using the appropriate trigger method
      switch (triggerType) {
        case "invoice.created":
          await workflowTriggerIntegration.triggerInvoiceCreated(finalTestData, "test-org");
          break;
        case "invoice.sent":
          await workflowTriggerIntegration.triggerInvoiceSent(finalTestData, "test-org");
          break;
        case "invoice.paid":
          await workflowTriggerIntegration.triggerInvoicePaid(finalTestData, "test-org");
          break;
        case "invoice.overdue":
          await workflowTriggerIntegration.triggerInvoiceOverdue(finalTestData, "test-org");
          break;
        case "proposal.created":
          await workflowTriggerIntegration.triggerProposalCreated(finalTestData, "test-org");
          break;
        case "proposal.approved":
          await workflowTriggerIntegration.triggerProposalApproved(finalTestData, "test-org");
          break;
        case "proposal.rejected":
          await workflowTriggerIntegration.triggerProposalRejected(finalTestData, "test-org");
          break;
        case "contract.expiring":
          await workflowTriggerIntegration.triggerContractExpiring(finalTestData, "test-org");
          break;
        case "contract.expired":
          await workflowTriggerIntegration.triggerContractExpired(finalTestData, "test-org");
          break;
        case "user.joined":
          await workflowTriggerIntegration.triggerUserJoined(finalTestData, "test-org");
          break;
        case "manual.trigger":
          await workflowTriggerIntegration.triggerManual(finalTestData, "test-org");
          break;
        case "webhook.external":
          await workflowTriggerIntegration.triggerWebhook(finalTestData, "test-org");
          break;
        default:
          throw new Error(`Unsupported trigger type: ${triggerType}`);
      }
      
      const duration = Date.now() - startTime;
      
      loggerService.info("Workflow trigger test completed", { workflowId, triggerType, duration });
      
      return {
        success: true,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      loggerService.error("Workflow trigger test failed", {
        workflowId,
        triggerType,
        error: error.message,
        duration,
      });
      
      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  },

  validateWorkflow(workflow: Workflow): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check basic workflow structure
    if (!workflow.name || workflow.name.trim().length === 0) {
      errors.push("Workflow name is required");
    }
    
    if (!workflow.trigger) {
      errors.push("Workflow trigger is required");
    }
    
    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push("Workflow must have at least one step");
    }
    
    // Check steps
    if (workflow.steps) {
      workflow.steps.forEach((step, index) => {
        if (!step.name || step.name.trim().length === 0) {
          errors.push(`Step ${index + 1} must have a name`);
        }
        
        if (!step.actions || step.actions.length === 0) {
          errors.push(`Step ${index + 1} must have at least one action`);
        }
        
        // Check actions
        step.actions.forEach((action, actionIndex) => {
          if (!action.type) {
            errors.push(`Step ${index + 1}, Action ${actionIndex + 1} must have a type`);
          }
          
          // Validate action-specific requirements
          if (action.type === "send.email") {
            if (!action.config.recipient) {
              errors.push(`Step ${index + 1}, Action ${actionIndex + 1}: Email recipient is required`);
            }
            if (!action.config.subject) {
              errors.push(`Step ${index + 1}, Action ${actionIndex + 1}: Email subject is required`);
            }
          }
          
          if (action.type === "call.webhook") {
            if (!action.config.url) {
              errors.push(`Step ${index + 1}, Action ${actionIndex + 1}: Webhook URL is required`);
            }
          }
        });
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  },

  generateTestData(triggerType: WorkflowTriggerType): Record<string, unknown> {
    const baseData = {
      timestamp: new Date().toISOString(),
      testMode: true,
    };
    
    switch (triggerType) {
      case "invoice.created":
        return {
          ...baseData,
          invoice: {
            id: "test-invoice-123",
            number: "INV-001",
            amount: 1000,
            currency: "USD",
            status: "draft",
            customer: {
              id: "test-customer-123",
              name: "Test Customer",
              email: "test@example.com",
            },
            creatorId: "test-user-123",
            createdAt: new Date().toISOString(),
          },
        };
        
      case "invoice.sent":
        return {
          ...baseData,
          invoice: {
            id: "test-invoice-123",
            number: "INV-001",
            amount: 1000,
            currency: "USD",
            status: "sent",
            customer: {
              id: "test-customer-123",
              name: "Test Customer",
              email: "test@example.com",
            },
            sentAt: new Date().toISOString(),
          },
        };
        
      case "invoice.paid":
        return {
          ...baseData,
          invoice: {
            id: "test-invoice-123",
            number: "INV-001",
            amount: 1000,
            currency: "USD",
            status: "paid",
            customer: {
              id: "test-customer-123",
              name: "Test Customer",
              email: "test@example.com",
            },
            paidAt: new Date().toISOString(),
          },
          payment: {
            id: "test-payment-123",
            amount: 1000,
            currency: "USD",
            method: "credit_card",
            date: new Date().toISOString(),
          },
        };
        
      case "invoice.overdue":
        return {
          ...baseData,
          invoice: {
            id: "test-invoice-123",
            number: "INV-001",
            amount: 1000,
            currency: "USD",
            status: "overdue",
            customer: {
              id: "test-customer-123",
              name: "Test Customer",
              email: "test@example.com",
            },
            dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
            daysOverdue: 7,
          },
        };
        
      case "proposal.created":
        return {
          ...baseData,
          proposal: {
            id: "test-proposal-123",
            title: "Test Proposal",
            amount: 5000,
            currency: "USD",
            status: "draft",
            client: {
              id: "test-client-123",
              name: "Test Client",
              email: "client@example.com",
            },
            creatorId: "test-user-123",
            createdAt: new Date().toISOString(),
          },
        };
        
      case "proposal.approved":
        return {
          ...baseData,
          proposal: {
            id: "test-proposal-123",
            title: "Test Proposal",
            amount: 5000,
            currency: "USD",
            status: "approved",
            client: {
              id: "test-client-123",
              name: "Test Client",
              email: "client@example.com",
            },
            approvedAt: new Date().toISOString(),
            approvedBy: "test-manager-123",
          },
        };
        
      case "contract.expiring":
        return {
          ...baseData,
          contract: {
            id: "test-contract-123",
            name: "Test Contract",
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            daysUntilExpiry: 30,
            client: {
              id: "test-client-123",
              name: "Test Client",
              email: "client@example.com",
            },
            accountManagerId: "test-manager-123",
          },
        };
        
      case "user.joined":
        return {
          ...baseData,
          user: {
            id: "test-user-123",
            name: "Test User",
            email: "user@example.com",
            role: "member",
            joinedAt: new Date().toISOString(),
          },
          organization: {
            id: "test-org-123",
            name: "Test Organization",
          },
        };
        
      case "manual.trigger":
        return {
          ...baseData,
          triggeredBy: "test-user-123",
          triggerReason: "Manual test execution",
        };
        
      case "webhook.external":
        return {
          ...baseData,
          webhook: {
            url: "https://example.com/webhook",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: {
              event: "test-event",
              data: "test-data",
            },
          },
        };
        
      default:
        return baseData;
    }
  },
};
