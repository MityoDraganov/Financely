import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getProductRepository } from "../repositories/product-repository";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { getProposalGenerationService } from "../services/ai/proposal-generation-service";
import { Lead } from "../core";
import { WorkflowExecutionEngine } from "../services/workflow-execution-engine";
import { WorkflowEvent } from "../core/entities/workflow-execution";
import { HttpRequestExecutor } from "../executors/http-request-executor";
import { EmailExecutor } from "../executors/email-executor";
import { InvoiceExecutor } from "../executors/invoice-executor";
import { ProposalExecutor } from "../executors/proposal-executor";
import { LeadExecutor } from "../executors/lead-executor";
import { ContactExecutor } from "../executors/contact-executor";
import { SystemExecutor } from "../executors/system-executor";
import { SlackExecutor } from "../executors/slack-executor";
import { PdfExecutor } from "../executors/pdf-executor";
import { ProductExecutor } from "../executors/product-executor";
import { StripeExecutor } from "../executors/stripe-executor";

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

function getExecutionEngine(): WorkflowExecutionEngine {
  const executionEngine = new WorkflowExecutionEngine();
  
  const httpExecutor = HttpRequestExecutor;
  const emailExecutor = new EmailExecutor({
    resendApiKey: resendApiKey.value(),
    resendFromEmail: resendFromEmail.value(),
    resendFromName: resendFromName.value(),
  });
  const invoiceExecutor = new InvoiceExecutor();
  const proposalExecutor = new ProposalExecutor({
    resendApiKey: resendApiKey.value(),
    resendFromEmail: resendFromEmail.value(),
    resendFromName: resendFromName.value(),
  });
  const leadExecutor = new LeadExecutor();
  const contactExecutor = new ContactExecutor();
  const systemExecutor = new SystemExecutor();
  const slackExecutor = new SlackExecutor();
  const pdfExecutor = new PdfExecutor();
  const productExecutor = new ProductExecutor();
  const stripeExecutor = new StripeExecutor();

  executionEngine.registerExecutor("http_request", httpExecutor);
  executionEngine.registerExecutor("call.webhook", httpExecutor);
  executionEngine.registerExecutor("send.email", emailExecutor);
  executionEngine.registerExecutor("send.slack", slackExecutor);
  executionEngine.registerExecutor("update.invoice.status", invoiceExecutor);
  executionEngine.registerExecutor("generate.pdf", pdfExecutor);
  executionEngine.registerExecutor("create.proposal", proposalExecutor);
  executionEngine.registerExecutor("send.proposal", proposalExecutor);
  executionEngine.registerExecutor("convert.proposal_to_invoice", proposalExecutor);
  executionEngine.registerExecutor("create.lead", leadExecutor);
  executionEngine.registerExecutor("update.lead.status", leadExecutor);
  executionEngine.registerExecutor("convert.lead_to_contact", leadExecutor);
  executionEngine.registerExecutor("create.contact", contactExecutor);
  executionEngine.registerExecutor("update.contact", contactExecutor);
  executionEngine.registerExecutor("add.product_to_proposal", productExecutor);
  executionEngine.registerExecutor("create.stripe.invoice", stripeExecutor);
  executionEngine.registerExecutor("wait.delay", systemExecutor);
  executionEngine.registerExecutor("archive.record", systemExecutor);
  executionEngine.registerExecutor("update.field", systemExecutor);
  
  return executionEngine;
}

/**
 * Firestore trigger that automatically generates proposal suggestions for new leads
 * when the organization has auto-suggestions enabled
 */
export const onLeadCreated = onDocumentCreated(
  {
    document: "leads/{leadId}",
    region: "us-central1",
    secrets: [geminiApiKey, resendApiKey, resendFromEmail, resendFromName],
    timeoutSeconds: 540, // 9 minutes max
    memory: "512MiB",
  },
  async (event) => {
    const leadData = event.data?.data();
    if (!leadData) {
      logger.warn("No lead data in event");
      return;
    }

    const leadId = event.params.leadId;
    const organizationId = leadData.organizationId;

    if (!organizationId) {
      logger.warn("Lead missing organizationId", { leadId });
      return;
    }

    // Trigger workflow for lead.created event (always, regardless of status)
    try {
      const workflowEvent: WorkflowEvent = {
        eventId: uuidv4(),
        tenantId: organizationId,
        type: "lead.created",
        payload: {
          leadId,
          ...leadData,
        },
        timestamp: FieldValue.serverTimestamp() as any,
      };

      const executionEngine = getExecutionEngine();
      await executionEngine.processEvent(workflowEvent);
      
      logger.info("Triggered workflow for lead.created event", {
        leadId,
        organizationId,
        eventId: workflowEvent.eventId,
      });
    } catch (error) {
      logger.error("Error triggering workflow for lead.created event", {
        leadId,
        organizationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't throw - we don't want to fail the lead creation if workflow trigger fails
    }

    // Only process new leads for proposal generation
    if (leadData.status !== "new") {
      logger.info("Lead not in 'new' status, skipping auto-proposal generation", {
        leadId,
        status: leadData.status,
      });
      return;
    }

    logger.info("Processing auto-proposal generation for new lead", {
      leadId,
      organizationId,
    });

    try {
      const databaseService = getDatabaseService();
      const organizationRepository = getOrganizationRepository(databaseService);
      const productRepository = getProductRepository(databaseService);
      const proposalRepository = getProposalRepository(databaseService);

      // Get organization to check settings
      const organization = await organizationRepository.get({
        id: organizationId,
      });

      if (!organization) {
        logger.warn("Organization not found", { organizationId, leadId });
        return;
      }

      // Check if auto-suggestions are enabled
      const autoSuggestionsEnabled =
        organization.settings?.ai?.autoProposalSuggestions ?? false;

      if (!autoSuggestionsEnabled) {
        logger.info("Auto-proposal suggestions disabled for organization", {
          organizationId,
          leadId,
        });
        return;
      }

      // Build Lead object from the event data
      // The event.data?.data() returns the lead data directly
      // Type cast to LeadData to satisfy TypeScript
      const lead: Lead = {
        id: leadId,
        createdAt: leadData.createdAt || new Date().toISOString(),
        updatedAt: leadData.updatedAt || new Date().toISOString(),
        data: leadData as Lead["data"],
      };

      // Check if a proposal already exists for this lead
      const existingProposals = await proposalRepository.getAll({
        queryConstraints: [
          { field: "leadId", operator: "==", value: leadId },
        ],
      });

      if (existingProposals.length > 0) {
        logger.info("Proposal already exists for lead, skipping", {
          leadId,
          proposalCount: existingProposals.length,
        });
        return;
      }

      // Initialize AI service with Gemini provider
      const aiService = getAIService();
      const apiKey = geminiApiKey.value();
      
      if (!apiKey) {
        logger.error("GEMINI_API_KEY not configured");
        return;
      }

      // Register Gemini provider if not already registered
      if (!aiService.getProvider("gemini")) {
        const geminiProvider = new GeminiProvider({
          apiKey,
          model: "gemini-2.0-flash",
        });
        aiService.registerProvider(geminiProvider);
        aiService.setDefaultProvider("gemini");
      }

      // Get products for the organization
      const products = await productRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: organizationId },
          { field: "status", operator: "==", value: "active" },
        ],
      });

      // Generate proposal suggestion
      const proposalGenerationService = getProposalGenerationService();
      const productsForContext = products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        category: p.category,
      }));
      const proposalData = await proposalGenerationService.generateProposalSuggestion(
        lead,
        organization.name,
        productsForContext,
        {
          targetCurrency: organization.settings?.defaultCurrency || "USD",
          conversionPairs: organization.settings?.multiCurrency?.pairs || [],
        },
      );

      // Create the proposal
      const proposalId = await proposalRepository.create({ data: proposalData });

      logger.info("Auto-generated proposal for lead", {
        leadId,
        organizationId,
        proposalTitle: proposalData.title,
        proposalId,
      });

      // Record usage events (proposal creation + AI generation)
      try {
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        
        // Track AI proposal generation
        await recordUsageEvent({
          orgId: organizationId,
          userId: null, // Auto-generated by system
          featureId: USAGE_FEATURES.AI_PROPOSAL_GENERATE,
          metadata: {
            entityId: proposalId,
            context: "automation",
            payloadType: "proposal",
          },
        });
        
        // Track proposal creation
        await recordUsageEvent({
          orgId: organizationId,
          userId: null,
          featureId: USAGE_FEATURES.PROPOSAL_CREATE,
          metadata: {
            entityId: proposalId,
            context: "automation",
          },
        });
      } catch (usageError) {
        logger.warn("Failed to record usage events for auto-generated proposal", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to auto-generate proposal for lead", {
        leadId,
        organizationId,
        error: errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw - we don't want to fail the lead creation if proposal generation fails
    }
  },
);
