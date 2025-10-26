import { WorkflowTriggerType } from "@/core";
import { workflowTriggerService } from "./workflow-trigger-service";
import { loggerService } from "./logger-service";

export interface WorkflowTriggerIntegration {
  // Invoice triggers
  triggerInvoiceCreated: (invoiceData: Record<string, unknown>, orgId: string) => Promise<void>;
  triggerInvoiceSent: (invoiceData: Record<string, unknown>, orgId: string) => Promise<void>;
  triggerInvoicePaid: (paymentData: Record<string, unknown>, orgId: string) => Promise<void>;
  triggerInvoiceOverdue: (invoiceData: Record<string, unknown>, orgId: string) => Promise<void>;
  
  // Proposal triggers
  triggerProposalCreated: (proposalData: Record<string, unknown>, orgId: string) => Promise<void>;
  triggerProposalApproved: (proposalData: Record<string, unknown>, orgId: string) => Promise<void>;
  triggerProposalRejected: (proposalData: Record<string, unknown>, orgId: string) => Promise<void>;
  
  // Contract triggers
  triggerContractExpiring: (contractData: Record<string, unknown>, orgId: string) => Promise<void>;
  triggerContractExpired: (contractData: Record<string, unknown>, orgId: string) => Promise<void>;
  
  // User triggers
  triggerUserJoined: (userData: Record<string, unknown>, orgId: string) => Promise<void>;
  
  // Manual trigger
  triggerManual: (triggerData: Record<string, unknown>, orgId: string) => Promise<void>;
  
  // Webhook trigger
  triggerWebhook: (webhookData: Record<string, unknown>, orgId: string) => Promise<void>;
}

export const workflowTriggerIntegration: WorkflowTriggerIntegration = {
  async triggerInvoiceCreated(invoiceData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering invoice created workflow", { invoiceData, orgId });
      await workflowTriggerService.processTrigger("invoice.created", invoiceData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger invoice created workflow", {
        error: error.message,
        invoiceData,
        orgId,
      });
      throw error;
    }
  },

  async triggerInvoiceSent(invoiceData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering invoice sent workflow", { invoiceData, orgId });
      await workflowTriggerService.processTrigger("invoice.sent", invoiceData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger invoice sent workflow", {
        error: error.message,
        invoiceData,
        orgId,
      });
      throw error;
    }
  },

  async triggerInvoicePaid(paymentData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering invoice paid workflow", { paymentData, orgId });
      await workflowTriggerService.processTrigger("invoice.paid", paymentData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger invoice paid workflow", {
        error: error.message,
        paymentData,
        orgId,
      });
      throw error;
    }
  },

  async triggerInvoiceOverdue(invoiceData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering invoice overdue workflow", { invoiceData, orgId });
      await workflowTriggerService.processTrigger("invoice.overdue", invoiceData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger invoice overdue workflow", {
        error: error.message,
        invoiceData,
        orgId,
      });
      throw error;
    }
  },

  async triggerProposalCreated(proposalData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering proposal created workflow", { proposalData, orgId });
      await workflowTriggerService.processTrigger("proposal.created", proposalData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger proposal created workflow", {
        error: error.message,
        proposalData,
        orgId,
      });
      throw error;
    }
  },

  async triggerProposalApproved(proposalData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering proposal approved workflow", { proposalData, orgId });
      await workflowTriggerService.processTrigger("proposal.approved", proposalData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger proposal approved workflow", {
        error: error.message,
        proposalData,
        orgId,
      });
      throw error;
    }
  },

  async triggerProposalRejected(proposalData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering proposal rejected workflow", { proposalData, orgId });
      await workflowTriggerService.processTrigger("proposal.rejected", proposalData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger proposal rejected workflow", {
        error: error.message,
        proposalData,
        orgId,
      });
      throw error;
    }
  },

  async triggerContractExpiring(contractData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering contract expiring workflow", { contractData, orgId });
      await workflowTriggerService.processTrigger("contract.expiring", contractData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger contract expiring workflow", {
        error: error.message,
        contractData,
        orgId,
      });
      throw error;
    }
  },

  async triggerContractExpired(contractData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering contract expired workflow", { contractData, orgId });
      await workflowTriggerService.processTrigger("contract.expired", contractData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger contract expired workflow", {
        error: error.message,
        contractData,
        orgId,
      });
      throw error;
    }
  },

  async triggerUserJoined(userData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering user joined workflow", { userData, orgId });
      await workflowTriggerService.processTrigger("user.joined", userData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger user joined workflow", {
        error: error.message,
        userData,
        orgId,
      });
      throw error;
    }
  },

  async triggerManual(triggerData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering manual workflow", { triggerData, orgId });
      await workflowTriggerService.processTrigger("manual.trigger", triggerData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger manual workflow", {
        error: error.message,
        triggerData,
        orgId,
      });
      throw error;
    }
  },

  async triggerWebhook(webhookData: Record<string, unknown>, orgId: string): Promise<void> {
    try {
      loggerService.info("Triggering webhook workflow", { webhookData, orgId });
      await workflowTriggerService.processTrigger("webhook.external", webhookData, orgId);
    } catch (error: any) {
      loggerService.error("Failed to trigger webhook workflow", {
        error: error.message,
        webhookData,
        orgId,
      });
      throw error;
    }
  },
};

// Export convenience functions for common triggers
export const triggerWorkflows = {
  onInvoiceCreated: workflowTriggerIntegration.triggerInvoiceCreated,
  onInvoiceSent: workflowTriggerIntegration.triggerInvoiceSent,
  onInvoicePaid: workflowTriggerIntegration.triggerInvoicePaid,
  onInvoiceOverdue: workflowTriggerIntegration.triggerInvoiceOverdue,
  onProposalCreated: workflowTriggerIntegration.triggerProposalCreated,
  onProposalApproved: workflowTriggerIntegration.triggerProposalApproved,
  onProposalRejected: workflowTriggerIntegration.triggerProposalRejected,
  onContractExpiring: workflowTriggerIntegration.triggerContractExpiring,
  onContractExpired: workflowTriggerIntegration.triggerContractExpired,
  onUserJoined: workflowTriggerIntegration.triggerUserJoined,
  onManual: workflowTriggerIntegration.triggerManual,
  onWebhook: workflowTriggerIntegration.triggerWebhook,
};
