import { workflowService } from "./workflow-service";
import { WorkflowTriggerType } from "@/core";
import { loggerService } from "./logger-service";

/**
 * Service for handling workflow triggers and event processing
 */
export class WorkflowTriggerService {
  private static instance: WorkflowTriggerService;
  private triggerHandlers: Map<WorkflowTriggerType, (data: any) => Promise<void>> = new Map();

  private constructor() {
    this.initializeTriggerHandlers();
  }

  public static getInstance(): WorkflowTriggerService {
    if (!WorkflowTriggerService.instance) {
      WorkflowTriggerService.instance = new WorkflowTriggerService();
    }
    return WorkflowTriggerService.instance;
  }

  private initializeTriggerHandlers() {
    // Invoice triggers
    this.triggerHandlers.set("invoice.created", this.handleInvoiceCreated.bind(this));
    this.triggerHandlers.set("invoice.sent", this.handleInvoiceSent.bind(this));
    this.triggerHandlers.set("invoice.paid", this.handleInvoicePaid.bind(this));
    this.triggerHandlers.set("invoice.overdue", this.handleInvoiceOverdue.bind(this));

    // Proposal triggers
    this.triggerHandlers.set("proposal.created", this.handleProposalCreated.bind(this));
    this.triggerHandlers.set("proposal.approved", this.handleProposalApproved.bind(this));
    this.triggerHandlers.set("proposal.rejected", this.handleProposalRejected.bind(this));

    // Contract triggers
    this.triggerHandlers.set("contract.expiring", this.handleContractExpiring.bind(this));
    this.triggerHandlers.set("contract.expired", this.handleContractExpired.bind(this));

    // User triggers
    this.triggerHandlers.set("user.joined", this.handleUserJoined.bind(this));

    // Manual trigger
    this.triggerHandlers.set("manual.trigger", this.handleManualTrigger.bind(this));

    // Webhook trigger
    this.triggerHandlers.set("webhook.external", this.handleWebhookTrigger.bind(this));
  }

  /**
   * Process a workflow trigger event
   */
  public async processTrigger(
    triggerType: WorkflowTriggerType,
    triggerData: Record<string, any>,
    orgId: string
  ): Promise<void> {
    try {
      loggerService.info(`Processing trigger: ${triggerType}`, { triggerData, orgId });
      
      // Get the appropriate handler
      const handler = this.triggerHandlers.get(triggerType);
      if (!handler) {
        loggerService.warn(`No handler found for trigger type: ${triggerType}`);
        return;
      }

      // Execute the handler
      await handler(triggerData);

      // Trigger workflows for this event
      await workflowService.handleTrigger(triggerType, triggerData, orgId);

    } catch (error: any) {
      loggerService.error(`Error processing trigger ${triggerType}`, {
        error: error.message,
        triggerData,
        orgId,
      });
      throw error;
    }
  }

  /**
   * Register a custom trigger handler
   */
  public registerTriggerHandler(
    triggerType: WorkflowTriggerType,
    handler: (data: any) => Promise<void>
  ): void {
    this.triggerHandlers.set(triggerType, handler);
  }

  // Invoice trigger handlers
  private async handleInvoiceCreated(data: any): Promise<void> {
    loggerService.info("Invoice created trigger", { data });
    // Additional logic for invoice created events
  }

  private async handleInvoiceSent(data: any): Promise<void> {
    loggerService.info("Invoice sent trigger", { data });
    // Additional logic for invoice sent events
  }

  private async handleInvoicePaid(data: any): Promise<void> {
    loggerService.info("Invoice paid trigger", { data });
    // Additional logic for invoice paid events
  }

  private async handleInvoiceOverdue(data: any): Promise<void> {
    loggerService.info("Invoice overdue trigger", { data });
    // Additional logic for invoice overdue events
  }

  // Proposal trigger handlers
  private async handleProposalCreated(data: any): Promise<void> {
    loggerService.info("Proposal created trigger", { data });
    // Additional logic for proposal created events
  }

  private async handleProposalApproved(data: any): Promise<void> {
    loggerService.info("Proposal approved trigger", { data });
    // Additional logic for proposal approved events
  }

  private async handleProposalRejected(data: any): Promise<void> {
    loggerService.info("Proposal rejected trigger", { data });
    // Additional logic for proposal rejected events
  }

  // Contract trigger handlers
  private async handleContractExpiring(data: any): Promise<void> {
    loggerService.info("Contract expiring trigger", { data });
    // Additional logic for contract expiring events
  }

  private async handleContractExpired(data: any): Promise<void> {
    loggerService.info("Contract expired trigger", { data });
    // Additional logic for contract expired events
  }

  // User trigger handlers
  private async handleUserJoined(data: any): Promise<void> {
    loggerService.info("User joined trigger", { data });
    // Additional logic for user joined events
  }

  // Manual trigger handler
  private async handleManualTrigger(data: any): Promise<void> {
    loggerService.info("Manual trigger", { data });
    // Additional logic for manual triggers
  }

  // Webhook trigger handler
  private async handleWebhookTrigger(data: any): Promise<void> {
    loggerService.info("Webhook trigger", { data });
    // Additional logic for webhook triggers
  }
}

// Export singleton instance
export const workflowTriggerService = WorkflowTriggerService.getInstance();
