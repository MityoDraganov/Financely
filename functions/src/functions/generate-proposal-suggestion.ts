import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getLeadRepository } from "../repositories/lead-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getProductRepository } from "../repositories/product-repository";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { getProposalGenerationService } from "../services/ai/proposal-generation-service";
import { Lead } from "../core";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

interface GenerateProposalSuggestionPayload {
  leadId: string;
  organizationId: string;
}

/**
 * Firebase Cloud Function for generating proposal suggestions from a lead.
 * 
 * This function uses AI to generate a proposal suggestion based on lead information.
 * 
 * Request payload:
 * {
 *   leadId: string,
 *   organizationId: string
 * }
 * 
 * Response: ProposalData object
 */
export const generateProposalSuggestion = onCall<GenerateProposalSuggestionPayload>(
  {
    region: "us-central1",
    cors: true,
    secrets: [geminiApiKey],
    timeoutSeconds: 540, // 9 minutes max for AI generation
    memory: "512MiB",
  },
  async (request) => {
    try {
      const { leadId, organizationId } = request.data;

      if (!leadId) {
        throw new HttpsError(
          "invalid-argument",
          "leadId is required",
        );
      }

      if (!organizationId) {
        throw new HttpsError(
          "invalid-argument",
          "organizationId is required",
        );
      }

      logger.info("Generating proposal suggestion", {
        leadId,
        organizationId,
      });

      const databaseService = getDatabaseService();
      const leadRepository = getLeadRepository(databaseService);
      const organizationRepository = getOrganizationRepository(databaseService);
      const productRepository = getProductRepository(databaseService);

      // Get the lead
      const lead = await leadRepository.get({ id: leadId });
      if (!lead) {
        throw new HttpsError(
          "not-found",
          "Lead not found",
        );
      }

      // Get the organization
      const organization = await organizationRepository.get({
        id: organizationId,
      });
      if (!organization) {
        throw new HttpsError(
          "not-found",
          "Organization not found",
        );
      }

      // Get products for the organization
      const products = await productRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: organizationId },
          { field: "status", operator: "==", value: "active" },
        ],
      });

      // Initialize AI service with Gemini provider
      const aiService = getAIService();
      const apiKey = geminiApiKey.value();
      
      if (!apiKey) {
        throw new HttpsError(
          "failed-precondition",
          "GEMINI_API_KEY not configured",
        );
      }

      // Register Gemini provider if not already registered
      if (!aiService.getProvider("gemini")) {
        const geminiProvider = new GeminiProvider({
          apiKey,
          model: "gemini-2.5-flash",
        });
        aiService.registerProvider(geminiProvider);
        aiService.setDefaultProvider("gemini");
      }

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
        lead as Lead,
        organization.name,
        productsForContext
      );

      logger.info("Proposal suggestion generated successfully", {
        leadId,
        organizationId,
        proposalTitle: proposalData.title,
      });

      return proposalData;
    } catch (error) {
      logger.error("Error generating proposal suggestion", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to generate proposal suggestion",
      );
    }
  },
);


