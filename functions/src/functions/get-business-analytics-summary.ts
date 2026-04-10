import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import {
  BusinessAnalyticsSummaryPayload,
} from "../core/entities/business-analytics";
import { ORGANIZATION_ROLES } from "../core/roles";
import { getContactRepository } from "../repositories/contact-repository";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getOpportunityRepository } from "../repositories/opportunity-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getTemplateRepository } from "../repositories/template-repository";
import { getUserRepository } from "../repositories/user-repository";
import { BusinessAnalyticsService } from "../services/business-analytics-service";
import { getDatabaseService } from "../services/database-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";

async function loadAnalyticsDataset(orgId: string) {
  const databaseService = getDatabaseService();
  const invoiceRepository = getInvoiceRepository(databaseService);
  const proposalRepository = getProposalRepository(databaseService);
  const opportunityRepository = getOpportunityRepository(databaseService);
  const contactRepository = getContactRepository(databaseService);
  const templateRepository = getTemplateRepository(databaseService);
  const userRepository = getUserRepository(databaseService);
  const organizationRepository = getOrganizationRepository(databaseService);

  const [invoices, proposals, opportunities, contacts, templates, organization] =
    await Promise.all([
      invoiceRepository.getAll({
        queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
      }),
      proposalRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: orgId }],
      }),
      opportunityRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: orgId }],
      }),
      contactRepository.getAll({
        queryConstraints: [{ field: "organizationId", operator: "==", value: orgId }],
      }),
      templateRepository.getAll({
        queryConstraints: [{ field: "orgId", operator: "==", value: orgId }],
      }),
      organizationRepository.get({ id: orgId }),
    ]);

  const memberIds = Array.isArray(organization?.memberIds)
    ? (organization?.memberIds as string[])
    : [];
  const users = (
    await Promise.all(memberIds.map((memberId) => userRepository.get({ id: memberId })))
  ).filter((user): user is NonNullable<typeof user> => Boolean(user));

  return {
    invoices,
    proposals,
    opportunities,
    contacts,
    users,
    templates,
  };
}

export const getBusinessAnalyticsSummary = onCall<
  BusinessAnalyticsSummaryPayload,
  Promise<ReturnType<BusinessAnalyticsService["getSummary"]>>
>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    const payload = request.data;
    if (!payload?.orgId) {
      throw new HttpsError("invalid-argument", "orgId is required.");
    }
    if (!payload?.dateRange?.start || !payload?.dateRange?.end) {
      throw new HttpsError(
        "invalid-argument",
        "dateRange.start and dateRange.end are required.",
      );
    }

    await verifyAuthAndOrgMembership(request, payload.orgId, {
      requiredRole: ORGANIZATION_ROLES.VIEWER,
    });

    logger.info("getBusinessAnalyticsSummary invoked", {
      orgId: payload.orgId,
      comparePrevious: payload.comparePrevious !== false,
      hasFilters: Boolean(payload.filters),
    });

    const dataset = await loadAnalyticsDataset(payload.orgId);
    const service = new BusinessAnalyticsService(dataset);
    return service.getSummary(payload);
  },
);
