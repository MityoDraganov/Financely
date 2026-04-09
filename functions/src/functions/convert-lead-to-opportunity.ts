import { onCall, HttpsError } from "firebase-functions/v2/https";
import { loggerService } from "../services/logger-service";
import { getDatabaseService } from "../services/database-service";
import { getLeadRepository } from "../repositories/lead-repository";
import { getOpportunityRepository } from "../repositories/opportunity-repository";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";

interface ConvertLeadToOpportunityInput {
  leadId: string;
  organizationId: string;
  title: string;
  estimatedValue?: number;
  currency?: string;
  expectedCloseDate?: string;
}

interface ConvertLeadToOpportunityOutput {
  opportunityId: string;
}

export const convertLeadToOpportunity = onCall<
  ConvertLeadToOpportunityInput,
  Promise<ConvertLeadToOpportunityOutput>
>(
  {
    region: "us-central1",
    cors: true,
  },
  async (request) => {
    const { leadId, organizationId, title, estimatedValue, currency, expectedCloseDate } =
      request.data;

    if (!leadId) {
      throw new HttpsError("invalid-argument", "leadId is required");
    }
    if (!organizationId) {
      throw new HttpsError("invalid-argument", "organizationId is required");
    }
    if (!title) {
      throw new HttpsError("invalid-argument", "title is required");
    }

    await verifyAuthAndOrgMembership(request, organizationId);

    const databaseService = getDatabaseService();
    const leadRepository = getLeadRepository(databaseService);
    const opportunityRepository = getOpportunityRepository(databaseService);

    const lead = await leadRepository.get({ id: leadId });
    if (!lead) {
      throw new HttpsError("not-found", "Lead not found");
    }
    const leadData = lead.data || lead;
    if (leadData.organizationId !== organizationId) {
      throw new HttpsError("permission-denied", "Lead does not belong to this organization");
    }

    loggerService.info("Converting lead to opportunity", { leadId, organizationId });

    const opportunityId = await opportunityRepository.create({
      data: {
        organizationId,
        leadId,
        contactId: leadData.contactId,
        title,
        stage: "prospecting",
        estimatedValue,
        currency: currency ?? leadData.budgetCurrency,
        expectedCloseDate,
        proposalIds: [],
        tags: leadData.tags ?? [],
        notes: leadData.notes,
      },
    });

    await leadRepository.update({
      id: leadId,
      data: { status: "converted" },
    });

    loggerService.info("Lead converted to opportunity", { leadId, opportunityId });

    return { opportunityId };
  },
);
