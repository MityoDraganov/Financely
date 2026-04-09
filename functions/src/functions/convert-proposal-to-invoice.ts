/**
 * Firebase Cloud Function for converting proposals to invoices using AI
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { loggerService } from "../services/logger-service";
import { getDatabaseService } from "../services/database-service";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getOpportunityRepository } from "../repositories/opportunity-repository";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { ProposalToInvoiceService } from "../services/ai/proposal-to-invoice-service";
import { invoiceDataSchema, INVOICE_STATUSES } from "../core/entities/invoice";
import { PROPOSAL_STATUSES } from "../core/entities/proposal";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import { Template } from "../core/entities/template";
import { toTemplateSnapshot } from "../services/invoice-template-snapshot-service";
import {
  logAuditFailureForRequest,
  logAuditSuccessForRequest,
} from "../utils/audit-log-helper";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export interface ConvertProposalToInvoiceInput {
  proposalId: string;
  templateId: string;
  organizationId: string;
}

export interface ConvertProposalToInvoiceOutput {
  invoiceId: string;
  invoiceNumber?: string;
}

export const convertProposalToInvoice = onCall<
  ConvertProposalToInvoiceInput,
  Promise<ConvertProposalToInvoiceOutput>
>(
  {
    region: "us-central1",
    cors: true,
    invoker: "public", // Allow CORS preflight (OPTIONS) requests without auth
    secrets: [geminiApiKey],
    timeoutSeconds: 540, // 9 minutes max for AI generation
    memory: "512MiB",
  },
  async (request) => {
    const startTime = Date.now();
    let auditOrganizationId: string | undefined;
    let auditProposalId: string | undefined;
    let auditInvoiceId: string | undefined;
    let auditInvoiceNumber: string | undefined;
    try {
      const { proposalId, templateId, organizationId } = request.data;
      auditOrganizationId = organizationId;
      auditProposalId = proposalId;

      if (!proposalId) {
        throw new HttpsError("invalid-argument", "Proposal ID is required");
      }

      if (!templateId) {
        throw new HttpsError("invalid-argument", "Template ID is required");
      }

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "Organization ID is required");
      }

      loggerService.info("Converting proposal to invoice", {
        proposalId,
        templateId,
        organizationId,
      });

      // Get repositories
      const databaseService = getDatabaseService();
      const proposalRepository = getProposalRepository(databaseService);
      const organizationRepository = getOrganizationRepository(databaseService);
      const leadRepository = getLeadRepository(databaseService);
      const invoiceRepository = getInvoiceRepository(databaseService);
      const opportunityRepository = getOpportunityRepository(databaseService);

      // Fetch proposal
      const proposal = await proposalRepository.get({ id: proposalId });
      if (!proposal) {
        throw new HttpsError("not-found", "Proposal not found");
      }

      // Fetch template from Realtime Database (templates are stored in RTDB, not Firestore)
      const template = await realtimeDatabaseService.get<Template>("templates", templateId);
      if (!template) {
        loggerService.error("Template not found in Realtime Database", {
          templateId,
          organizationId,
        });
        throw new HttpsError("not-found", `Template not found: ${templateId}`);
      }
      
      // Verify template belongs to the organization
      if (template.orgId !== organizationId) {
        loggerService.error("Template organization mismatch", {
          templateId,
          templateOrgId: template.orgId,
          requestedOrgId: organizationId,
        });
        throw new HttpsError(
          "permission-denied",
          "Template does not belong to this organization"
        );
      }
      
      loggerService.info("Template found and verified", {
        templateId,
        templateName: template.name,
        organizationId,
      });

      // Fetch organization
      const organization = await organizationRepository.get({ id: organizationId });
      if (!organization) {
        throw new HttpsError("not-found", "Organization not found");
      }

      // Fetch lead if proposal has leadId
      let lead = null;
      if (proposal.leadId) {
        try {
          lead = await leadRepository.get({ id: proposal.leadId });
        } catch (error) {
          loggerService.warn("Lead not found for proposal", {
            proposalId,
            leadId: proposal.leadId,
          });
        }
      }

      // Initialize AI service with Gemini provider
      const aiService = getAIService();
      const apiKey = geminiApiKey.value();
      
      if (!apiKey) {
        throw new HttpsError(
          "failed-precondition",
          "GEMINI_API_KEY not configured"
        );
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

      const proposalToInvoiceService = new ProposalToInvoiceService(aiService);

      // Convert proposal to invoice data
      const conversionResult = await proposalToInvoiceService.convertProposalToInvoice(
        proposal,
        template,
        organization,
        lead || undefined
      );

      // Validate invoice data
      const validatedData = invoiceDataSchema.parse({
        orgId: organizationId, // Use orgId (not organizationId) as per invoice schema
        templateId,
        templateSnapshot: toTemplateSnapshot(template),
        data: conversionResult.invoiceData,
        status: INVOICE_STATUSES.UNSENT,
      });

      // Create invoice
      const invoiceId = await invoiceRepository.create({ data: validatedData });
      auditInvoiceId = invoiceId;

      if (!invoiceId) {
        throw new HttpsError("internal", "Failed to create invoice");
      }

      // Update proposal to link to invoice
      try {
        await proposalRepository.update({
          id: proposalId,
          data: {
            invoiceId,
            status: PROPOSAL_STATUSES.INVOICED,
          },
        });
      } catch (error) {
        loggerService.warn("Failed to update proposal with invoice ID", {
          proposalId,
          invoiceId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Don't fail the whole operation if this update fails
      }

      // If the proposal belongs to an opportunity, append the new invoice to its invoiceIds
      if (proposal.opportunityId) {
        try {
          await opportunityRepository.addToSet({
            id: proposal.opportunityId,
            fieldName: "invoiceIds",
            value: invoiceId as unknown as string[],
          });
        } catch (error) {
          loggerService.warn("Failed to update opportunity invoiceIds", {
            opportunityId: proposal.opportunityId,
            invoiceId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      loggerService.info("Proposal converted to invoice successfully", {
        proposalId,
        invoiceId,
      });
      auditInvoiceNumber = conversionResult.invoiceNumber;

      // Record usage events
      try {
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        const { extractUserContextFromRequest } = await import("../utils/request-context");
        
        const userContext = await extractUserContextFromRequest(request);
        
        // Track proposal conversion
        await recordUsageEvent({
          orgId: organizationId,
          userId: userContext?.userId || null,
          featureId: USAGE_FEATURES.PROPOSAL_CONVERT_TO_INVOICE,
          metadata: {
            entityId: proposalId,
            context: "api",
          },
        });
        
        // Track invoice creation from proposal
        await recordUsageEvent({
          orgId: organizationId,
          userId: userContext?.userId || null,
          featureId: USAGE_FEATURES.INVOICE_CREATE,
          metadata: {
            entityId: invoiceId,
            context: "api",
            payloadType: "invoice_from_proposal",
          },
        });
      } catch (usageError) {
        // Don't fail the operation if usage tracking fails
        loggerService.warn("Failed to record usage events for proposal conversion", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }

      await logAuditSuccessForRequest({
        request,
        operationName: "convertProposalToInvoice",
        organizationId,
        action: "proposal.converted_to_invoice",
        resource: {
          type: "proposal",
          id: proposalId,
          name: proposalId,
        },
        durationMs: Date.now() - startTime,
        metadata: {
          source: "api",
          sourceDetails: "convertProposalToInvoice",
          customFields: {
            templateId,
            invoiceId,
            invoiceNumber: conversionResult.invoiceNumber,
          },
        },
      });

      return {
        invoiceId,
        invoiceNumber: conversionResult.invoiceNumber,
      };
    } catch (error) {
      loggerService.error("Failed to convert proposal to invoice", {
        error: error instanceof Error ? error.message : "Unknown error",
        proposalId: request.data?.proposalId,
      });

      await logAuditFailureForRequest({
        request,
        operationName: "convertProposalToInvoice",
        organizationId: auditOrganizationId,
        action: "proposal.converted_to_invoice",
        error: error instanceof Error ? error : new Error(String(error)),
        resource: auditProposalId
          ? {
              type: "proposal",
              id: auditProposalId,
              name: auditProposalId,
            }
          : undefined,
        metadata: {
          source: "api",
          sourceDetails: "convertProposalToInvoice",
          customFields: {
            invoiceId: auditInvoiceId,
            invoiceNumber: auditInvoiceNumber,
          },
        },
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to convert proposal to invoice: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);
