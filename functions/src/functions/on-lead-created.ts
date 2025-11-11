import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getProductRepository } from "../repositories/product-repository";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { getProposalGenerationService } from "../services/ai/proposal-generation-service";
import { Lead } from "../core";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Firestore trigger that automatically generates proposal suggestions for new leads
 * when the organization has auto-suggestions enabled
 */
export const onLeadCreated = onDocumentCreated(
  {
    document: "leads/{leadId}",
    region: "us-central1",
    secrets: [geminiApiKey],
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

    // Only process new leads
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
          model: "gemini-2.5-flash",
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
        productsForContext
      );

      // Create the proposal
      await proposalRepository.create({ data: proposalData });

      logger.info("Auto-generated proposal for lead", {
        leadId,
        organizationId,
        proposalTitle: proposalData.title,
      });
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

