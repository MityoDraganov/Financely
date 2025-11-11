/**
 * Firebase Cloud Function for generating invoice data from a proposal (without creating the invoice)
 * This allows users to review and edit the AI-generated data before creating the invoice
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { loggerService } from "../services/logger-service";
import { getDatabaseService } from "../services/database-service";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { ProposalToInvoiceService } from "../services/ai/proposal-to-invoice-service";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import { Template } from "../core/entities/template";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export interface GenerateInvoiceFromProposalInput {
  proposalId: string;
  templateId: string;
  organizationId: string;
}

export interface GenerateInvoiceFromProposalOutput {
  invoiceData: Record<string, unknown>;
  invoiceNumber?: string;
  templateId: string;
}

export const generateInvoiceFromProposal = onCall<
  GenerateInvoiceFromProposalInput,
  Promise<GenerateInvoiceFromProposalOutput>
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
    try {
      const { proposalId, templateId, organizationId } = request.data;

      if (!proposalId) {
        throw new HttpsError("invalid-argument", "Proposal ID is required");
      }

      if (!templateId) {
        throw new HttpsError("invalid-argument", "Template ID is required");
      }

      if (!organizationId) {
        throw new HttpsError("invalid-argument", "Organization ID is required");
      }

      loggerService.info("Generating invoice data from proposal", {
        proposalId,
        templateId,
        organizationId,
      });

      // Get repositories
      const databaseService = getDatabaseService();
      const proposalRepository = getProposalRepository(databaseService);
      const organizationRepository = getOrganizationRepository(databaseService);
      const leadRepository = getLeadRepository(databaseService);

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
          model: "gemini-2.0-flash-exp",
        });
        aiService.registerProvider(geminiProvider);
        aiService.setDefaultProvider("gemini");
      }

      const proposalToInvoiceService = new ProposalToInvoiceService(aiService);

      // Convert proposal to invoice data (without creating the invoice)
      const conversionResult = await proposalToInvoiceService.convertProposalToInvoice(
        proposal,
        template,
        organization,
        lead || undefined
      );

      loggerService.info("Invoice data generated successfully", {
        proposalId,
        templateId,
        invoiceNumber: conversionResult.invoiceNumber,
      });

      return {
        invoiceData: conversionResult.invoiceData,
        invoiceNumber: conversionResult.invoiceNumber,
        templateId,
      };
    } catch (error) {
      loggerService.error("Failed to generate invoice data from proposal", {
        error: error instanceof Error ? error.message : "Unknown error",
        proposalId: request.data?.proposalId,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Failed to generate invoice data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

