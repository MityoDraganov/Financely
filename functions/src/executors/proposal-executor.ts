import { logger } from "firebase-functions";
import { ActionExecutor } from "../core/entities/workflow-execution";
import { getDatabaseService } from "../services/database-service";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { ProposalToInvoiceService } from "../services/ai/proposal-to-invoice-service";
import { invoiceDataSchema } from "../core/entities/invoice";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import { Template } from "../core/entities/template";
import { ResendEmailService } from "../services/resend-email-service";
import { EmailSendOptions } from "../services/email-service-types";
import { defineSecret } from "firebase-functions/params";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export interface CreateProposalConfig {
  clientId: string;
  items: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
  validUntil?: string;
}

export interface SendProposalConfig {
  proposalId: string;
  recipientEmail: string;
  subject?: string;
  message?: string;
}

export interface ConvertProposalConfig {
  proposalId: string;
}

export class ProposalExecutor implements ActionExecutor {
  type = "proposal_action";
  private emailService?: ResendEmailService;

  constructor(secrets?: {
    resendApiKey?: string;
    resendFromEmail?: string;
    resendFromName?: string;
  }) {
    if (secrets) {
      this.emailService = new ResendEmailService({
        apiKey: secrets.resendApiKey || '',
        defaultFromEmail: secrets.resendFromEmail || '',
        defaultFromName: secrets.resendFromName || '',
      });
    }
  }

  async execute(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    try {
      logger.info("Executing proposal action", { 
        runId, 
        actionId: action.id,
        actionType: action.type
      });

      if (action.type === "create.proposal") {
        return await this.createProposal(action, context, runId);
      } else if (action.type === "send.proposal") {
        return await this.sendProposal(action, context, runId);
      } else if (action.type === "convert.proposal_to_invoice") {
        return await this.convertProposal(action, context, runId);
      } else {
        throw new Error(`Unsupported proposal action type: ${action.type}`);
      }
    } catch (error) {
      logger.error("Error executing proposal action", { 
        runId, 
        actionId: action.id,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
      throw error;
    }
  }

  private async createProposal(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as CreateProposalConfig;
    
    // Resolve template variables
    const resolvedClientId = this.resolveTemplate(config.clientId, context);
    
    // Get orgId from context
    const orgId = context.orgId as string || context.tenantId as string;
    if (!orgId) {
      throw new Error("orgId or tenantId is required in context");
    }

    // Build proposal items
    const proposalItems = config.items.map(item => ({
      description: this.resolveTemplate(item.description, context),
      qty: item.quantity,
      unitPrice: item.price,
    }));

    // Calculate totals
    const subtotal = proposalItems.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
    const taxTotal = 0; // No tax by default
    const total = subtotal + taxTotal;

    // Build proposal data according to ProposalData schema
    const proposalData = {
      organizationId: orgId,
      ...(resolvedClientId && { leadId: resolvedClientId }), // Using leadId field if clientId is provided
      title: `Proposal for ${resolvedClientId}`,
      status: "DRAFT" as const,
      items: proposalItems,
      subtotal,
      taxTotal,
      total,
      currency: "USD",
      aiGenerated: false,
      isIncomplete: false,
      ...(config.validUntil && { validUntil: this.resolveTemplate(config.validUntil, context) }),
    };

    const databaseService = getDatabaseService();
    const proposalRepository = getProposalRepository(databaseService);
    const proposalId = await proposalRepository.create({ data: proposalData });

    logger.info("Proposal created successfully", { 
      runId, 
      actionId: action.id,
      proposalId 
    });

    // Record usage event
    try {
      const { recordUsageEvent } = await import("../usage");
      const { USAGE_FEATURES } = await import("../usage/usage-features");
      
      await recordUsageEvent({
        orgId,
        userId: null, // Workflow actions are system-triggered
        featureId: USAGE_FEATURES.PROPOSAL_CREATE,
        metadata: {
          entityId: proposalId,
          context: "automation",
        },
      });
    } catch (usageError) {
      logger.warn("Failed to record usage event for proposal creation", {
        error: usageError instanceof Error ? usageError.message : String(usageError),
      });
    }

    return {
      success: true,
      proposalId,
      clientId: resolvedClientId,
    };
  }

  private async sendProposal(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as SendProposalConfig;
    
    if (!this.emailService) {
      throw new Error("Email service not configured for sending proposals");
    }

    // Resolve template variables
    const resolvedProposalId = this.resolveTemplate(config.proposalId, context);
    const resolvedEmail = this.resolveTemplate(config.recipientEmail, context);
    const resolvedSubject = config.subject 
      ? this.resolveTemplate(config.subject, context)
      : "Proposal";
    const resolvedMessage = config.message 
      ? this.resolveTemplate(config.message, context)
      : "Please review the attached proposal.";

    // Get proposal to include in email
    const databaseService = getDatabaseService();
    const proposalRepository = getProposalRepository(databaseService);
    const proposal = await proposalRepository.get({ id: resolvedProposalId });
    
    if (!proposal) {
      throw new Error(`Proposal not found: ${resolvedProposalId}`);
    }

    // Send email
    const emailOptions: EmailSendOptions = {
      to: [{ email: resolvedEmail }],
      from: {
        email: 'noreply@financely.app',
        name: 'Financely',
      },
      subject: resolvedSubject,
      html: `<p>${resolvedMessage}</p><p>Proposal: ${proposal.title || 'Proposal'}</p>`,
      text: `${resolvedMessage}\n\nProposal: ${proposal.title || 'Proposal'}`,
    };

    const emailResult = await this.emailService.sendEmail(emailOptions);

    logger.info("Proposal sent successfully", { 
      runId, 
      actionId: action.id,
      proposalId: resolvedProposalId,
      recipient: resolvedEmail
    });

    // Record usage event
    try {
      const orgId = (context.orgId as string) || (context.tenantId as string);
      if (orgId) {
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        
        await recordUsageEvent({
          orgId,
          userId: null, // Workflow actions are system-triggered
          featureId: USAGE_FEATURES.PROPOSAL_SEND,
          metadata: {
            entityId: resolvedProposalId,
            context: "automation",
          },
        });
      }
    } catch (usageError) {
      logger.warn("Failed to record usage event for proposal send", {
        error: usageError instanceof Error ? usageError.message : String(usageError),
      });
    }

    return {
      success: emailResult.success,
      proposalId: resolvedProposalId,
      recipient: resolvedEmail,
      messageId: emailResult.messageId,
    };
  }

  private async convertProposal(
    action: any,
    context: Record<string, unknown>,
    runId: string
  ): Promise<Record<string, unknown>> {
    const config = action.config as ConvertProposalConfig;
    
    // Resolve template variables
    const resolvedProposalId = this.resolveTemplate(config.proposalId, context);
    
    // Get orgId from context
    const orgId = context.orgId as string || context.tenantId as string;
    if (!orgId) {
      throw new Error("orgId or tenantId is required in context");
    }

    const databaseService = getDatabaseService();
    const proposalRepository = getProposalRepository(databaseService);
    const organizationRepository = getOrganizationRepository(databaseService);
    const leadRepository = getLeadRepository(databaseService);
    const invoiceRepository = getInvoiceRepository(databaseService);

    // Get proposal
    const proposal = await proposalRepository.get({ id: resolvedProposalId });
    if (!proposal) {
      throw new Error(`Proposal not found: ${resolvedProposalId}`);
    }

    // Get template ID from proposal or use default
    const templateId = (proposal as any).templateId || "";
    if (!templateId) {
      throw new Error("Template ID is required for converting proposal to invoice. Proposal must have a templateId.");
    }

    // Get template from Realtime Database
    const template = await realtimeDatabaseService.get<Template>("templates", templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Verify template belongs to organization
    if (template.orgId !== orgId) {
      throw new Error("Template does not belong to this organization");
    }

    // Get organization
    const organization = await organizationRepository.get({ id: orgId });
    if (!organization) {
      throw new Error(`Organization not found: ${orgId}`);
    }

    // Get lead if proposal has leadId
    let lead = null;
    if ((proposal as any).leadId) {
      try {
        lead = await leadRepository.get({ id: (proposal as any).leadId });
      } catch (error) {
        logger.warn("Lead not found for proposal", {
          proposalId: resolvedProposalId,
          leadId: (proposal as any).leadId,
        });
      }
    }

    // Initialize AI service
    const aiService = getAIService();
    const apiKey = geminiApiKey.value();
    
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Register Gemini provider if not already registered
    if (!aiService.getProvider("gemini")) {
      const geminiProvider = new GeminiProvider({
        apiKey,
        model: "gemini-2.0-flash-exp",
      });
      aiService.registerProvider(geminiProvider);
      aiService.setDefaultProvider("gemini");
    }

    // Convert proposal to invoice
    const proposalToInvoiceService = new ProposalToInvoiceService(aiService);
    const conversionResult = await proposalToInvoiceService.convertProposalToInvoice(
      proposal,
      template,
      organization,
      lead || undefined
    );

    // Validate and create invoice
    const validatedData = invoiceDataSchema.parse({
      orgId,
      templateId,
      data: conversionResult.invoiceData,
      status: "draft",
    });

    const invoiceId = await invoiceRepository.create({ data: validatedData });
    if (!invoiceId) {
      throw new Error("Failed to create invoice");
    }

    // Update proposal to link to invoice
    try {
      await proposalRepository.update({
        id: resolvedProposalId,
        data: { invoiceId },
      });
    } catch (error) {
      logger.warn("Failed to update proposal with invoice ID", {
        proposalId: resolvedProposalId,
        invoiceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    logger.info("Proposal converted to invoice successfully", { 
      runId, 
      actionId: action.id,
      proposalId: resolvedProposalId,
      invoiceId
    });

    return {
      success: true,
      proposalId: resolvedProposalId,
      invoiceId,
      invoiceNumber: conversionResult.invoiceNumber,
    };
  }

  private resolveTemplate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = this.getNestedValue(context, key);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && current !== null) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }
}

