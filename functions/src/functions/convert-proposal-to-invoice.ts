/**
 * Firebase Cloud Function for converting proposals to invoices using AI
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { loggerService } from "../services/logger-service";
import { getDatabaseService } from "../services/database-service";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getTemplateRepository } from "../repositories/template-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { ProposalToInvoiceService } from "../services/ai/proposal-to-invoice-service";
import { invoiceDataSchema } from "../core/entities/invoice";

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

      loggerService.info("Converting proposal to invoice", {
        proposalId,
        templateId,
        organizationId,
      });

      // Get repositories
      const databaseService = getDatabaseService();
      const proposalRepository = getProposalRepository(databaseService);
      const templateRepository = getTemplateRepository(databaseService);
      const organizationRepository = getOrganizationRepository(databaseService);
      const leadRepository = getLeadRepository(databaseService);
      const invoiceRepository = getInvoiceRepository(databaseService);

      // Fetch proposal
      const proposal = await proposalRepository.get({ id: proposalId });
      if (!proposal) {
        throw new HttpsError("not-found", "Proposal not found");
      }

      // Fetch template
      const template = await templateRepository.get({ id: templateId });
      if (!template) {
        throw new HttpsError("not-found", "Template not found");
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

      // Convert proposal to invoice data
      const conversionResult = await proposalToInvoiceService.convertProposalToInvoice(
        proposal,
        template,
        organization,
        lead || undefined
      );

      // Validate invoice data
      const validatedData = invoiceDataSchema.parse({
        organizationId,
        templateId,
        data: conversionResult.invoiceData,
        status: "draft",
      });

      // Create invoice
      const invoiceId = await invoiceRepository.create({ data: validatedData });

      if (!invoiceId) {
        throw new HttpsError("internal", "Failed to create invoice");
      }

      // Update proposal to link to invoice
      try {
        await proposalRepository.update({
          id: proposalId,
          data: { invoiceId },
        });
      } catch (error) {
        loggerService.warn("Failed to update proposal with invoice ID", {
          proposalId,
          invoiceId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Don't fail the whole operation if this update fails
      }

      loggerService.info("Proposal converted to invoice successfully", {
        proposalId,
        invoiceId,
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

