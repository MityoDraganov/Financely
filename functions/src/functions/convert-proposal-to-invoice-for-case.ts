import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getDatabaseService } from "../services/database-service";
import { getProposalRepository } from "../repositories/proposal-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { getInvoiceRepository } from "../repositories/invoice-repository";
import { getAIService } from "../services/ai/ai-service";
import { GeminiProvider } from "../services/ai/gemini-provider";
import { ProposalToInvoiceService } from "../services/ai/proposal-to-invoice-service";
import { invoiceDataSchema, INVOICE_STATUSES } from "../core/entities/invoice";
import { PROPOSAL_STATUSES } from "../core/entities/proposal";
import { Template } from "../core/entities/template";
import { realtimeDatabaseService } from "../infrastructure/realtime-database-service";
import { toTemplateSnapshot } from "../services/invoice-template-snapshot-service";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import {
  canTransitionCommercialCaseStage,
  COMMERCIAL_CASE_STAGES,
} from "../core/entities/commercial-case";
import {
  emitInvoiceLinkedToCaseEvent,
  emitProposalLinkedToCaseEvent,
  getCommercialCaseOrThrow,
  transitionCommercialCaseStage,
} from "../services/commercial-case-lifecycle-service";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

type ConvertProposalToInvoiceForCaseInput = {
  proposalId: string;
  templateId: string;
  organizationId: string;
  commercialCaseId: string;
};

export const convertProposalToInvoiceForCase = onCall<
  ConvertProposalToInvoiceForCaseInput,
  Promise<{ invoiceId: string; invoiceNumber?: string }>
>(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    secrets: [geminiApiKey],
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (request) => {
    const payload = request.data;
    const { proposalId, templateId, organizationId, commercialCaseId } = payload;
    if (!proposalId || !templateId || !organizationId || !commercialCaseId) {
      throw new HttpsError(
        "invalid-argument",
        "proposalId, templateId, organizationId, and commercialCaseId are required",
      );
    }

    const auth = await verifyAuthAndOrgMembership(request, organizationId);
    const databaseService = getDatabaseService();
    const proposalRepository = getProposalRepository(databaseService);
    const organizationRepository = getOrganizationRepository(databaseService);
    const leadRepository = getLeadRepository(databaseService);
    const invoiceRepository = getInvoiceRepository(databaseService);

    const proposal = await proposalRepository.get({ id: proposalId });
    if (!proposal) {
      throw new HttpsError("not-found", "Proposal not found");
    }
    if (proposal.commercialCaseId !== commercialCaseId) {
      throw new HttpsError(
        "failed-precondition",
        "Proposal does not belong to the provided commercial case",
      );
    }

    const commercialCase = await getCommercialCaseOrThrow(
      commercialCaseId,
      organizationId,
    );
    const canMoveToInvoiced =
      commercialCase.stage === COMMERCIAL_CASE_STAGES.INVOICED ||
      commercialCase.stage === COMMERCIAL_CASE_STAGES.PAID ||
      canTransitionCommercialCaseStage(
        commercialCase.stage,
        COMMERCIAL_CASE_STAGES.INVOICED,
      );
    if (!canMoveToInvoiced) {
      throw new HttpsError(
        "failed-precondition",
        `Case stage ${commercialCase.stage} must reach WON before invoicing`,
      );
    }

    const template = await realtimeDatabaseService.get<Template>("templates", templateId);
    if (!template) {
      throw new HttpsError("not-found", `Template not found: ${templateId}`);
    }
    if (template.orgId !== organizationId) {
      throw new HttpsError("permission-denied", "Template does not belong to this organization");
    }

    const organization = await organizationRepository.get({ id: organizationId });
    if (!organization) {
      throw new HttpsError("not-found", "Organization not found");
    }

    let lead = null;
    if (proposal.leadId) {
      lead = await leadRepository.get({ id: proposal.leadId });
    }

    const aiService = getAIService();
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "GEMINI_API_KEY not configured");
    }
    if (!aiService.getProvider("gemini")) {
      aiService.registerProvider(
        new GeminiProvider({ apiKey, model: "gemini-2.0-flash" }),
      );
      aiService.setDefaultProvider("gemini");
    }

    const proposalToInvoiceService = new ProposalToInvoiceService(aiService);
    const conversionResult = await proposalToInvoiceService.convertProposalToInvoice(
      proposal,
      template,
      organization,
      lead || undefined,
    );

    const validatedData = invoiceDataSchema.parse({
      orgId: organizationId,
      commercialCaseId,
      templateId,
      templateSnapshot: toTemplateSnapshot(template),
      data: conversionResult.invoiceData,
      status: INVOICE_STATUSES.UNSENT,
    });
    const invoiceId = await invoiceRepository.create({ data: validatedData });
    if (!invoiceId) {
      throw new HttpsError("internal", "Failed to create invoice");
    }

    await proposalRepository.update({
      id: proposalId,
      data: {
        invoiceId,
        status: PROPOSAL_STATUSES.INVOICED,
      },
    });

    if (
      commercialCase.stage !== COMMERCIAL_CASE_STAGES.INVOICED &&
      commercialCase.stage !== COMMERCIAL_CASE_STAGES.PAID
    ) {
      await transitionCommercialCaseStage({
        organizationId,
        commercialCaseId,
        toStage: COMMERCIAL_CASE_STAGES.INVOICED,
        actorUserId: auth.userId,
      });
    }

    await emitProposalLinkedToCaseEvent({
      organizationId,
      commercialCaseId,
      proposalId,
      actorUserId: auth.userId,
    });
    await emitInvoiceLinkedToCaseEvent({
      organizationId,
      commercialCaseId,
      invoiceId,
      actorUserId: auth.userId,
    });

    return {
      invoiceId,
      invoiceNumber: conversionResult.invoiceNumber,
    };
  },
);
