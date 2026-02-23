import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { handleUploadInvoiceFile } from "../app/handle-upload-invoice-file";
import { handleExtractInvoiceData } from "../app/handle-extract-invoice-data";
import { handleGenerateTemplateFromInvoiceFile } from "../app/handle-generate-template-from-extraction";
import { CreateExtractionJobInput } from "../core/entities/invoice-extraction-job";
import { TemplateData } from "../core/entities/template";
import { Organization } from "../core/entities/organization";
import { loggerService } from "../services/logger-service";
import { extractUserContextFromRequest } from "../utils/request-context";
import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { verifyAuthAndOrgMembership } from "../utils/auth-utils";
import { ORGANIZATION_ROLES } from "../core/roles";
import {
  AI_TASKS,
  configureAIProviderForTask,
  geminiApiKeySecret,
  openAiApiKeySecret,
} from "../services/ai/provider-routing";

/** Payload for action "upload": create extraction job from file URL */
type UploadPayload = CreateExtractionJobInput;

/** Payload for action "extract": run OCR + AI on existing job */
type RuntimeAiSelection = {
  provider?: "auto" | "gemini" | "openai";
  model?: string;
};

type ExtractPayload = {
  jobId: string;
  ai?: RuntimeAiSelection;
};

/** Payload for action "generateTemplate": build template from uploaded invoice file */
type GenerateTemplateOptions = {
  style?: "modern" | "classic" | "minimal" | "professional";
  templateName?: string;
};

type GenerateTemplatePayload = {
  jobId: string;
  editedData?: Record<string, unknown>;
  options?: GenerateTemplateOptions;
  ai?: RuntimeAiSelection;
};

type InvoiceExtractionPayload =
  | ({ action: "upload" } & UploadPayload)
  | ({ action: "extract" } & ExtractPayload)
  | ({ action: "generateTemplate" } & GenerateTemplatePayload);

type InvoiceExtractionResponse =
  | { action: "upload"; jobId: string }
  | { action: "extract"; job: unknown }
  | {
      action: "generateTemplate";
      template: TemplateData;
      quality: { overall: number; layout: number; text: number; table: number; font: number };
      needsReview: boolean;
      reviewReasons: string[];
    };

/**
 * Single Cloud Function for the invoice upload + extraction + template generation flow.
 * Dispatches to handlers by action for upload, extract, and generateTemplate.
 */
export const invoiceExtraction = onCall<
  InvoiceExtractionPayload,
  Promise<InvoiceExtractionResponse>
>(
  {
    region: "us-central1",
    cors: true,
    secrets: [geminiApiKeySecret, openAiApiKeySecret],
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (request) => {
    const payload = request.data;
    if (!payload || typeof payload.action !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Payload must include action: 'upload' | 'extract' | 'generateTemplate'"
      );
    }

    const { action } = payload;

    if (action === "upload") {
      return handleUploadAction(request, payload as { action: "upload" } & UploadPayload);
    }
    if (action === "extract") {
      return handleExtractAction(request, payload as { action: "extract" } & ExtractPayload);
    }
    if (action === "generateTemplate") {
      return handleGenerateTemplateAction(
        request,
        payload as { action: "generateTemplate" } & GenerateTemplatePayload
      );
    }

    throw new HttpsError(
      "invalid-argument",
      `Unknown action: ${action}. Use 'upload' | 'extract' | 'generateTemplate'.`
    );
  }
);

async function handleUploadAction(
  request: CallableRequest<InvoiceExtractionPayload>,
  payload: { action: "upload" } & UploadPayload
): Promise<InvoiceExtractionResponse> {
  const { orgId, fileUrl, fileName, fileType, fileSizeBytes } = payload;
  if (!orgId) {
    throw new HttpsError("invalid-argument", "Organization ID (orgId) is required");
  }
  await verifyAuthAndOrgMembership(request, orgId, {
    requiredRole: ORGANIZATION_ROLES.MEMBER,
  });
  if (!fileUrl || !fileName || !fileType || !fileSizeBytes || fileSizeBytes <= 0) {
    throw new HttpsError(
      "invalid-argument",
      "fileUrl, fileName, fileType, and positive fileSizeBytes are required"
    );
  }

  loggerService.info("Invoice extraction: upload", { orgId, fileName });
  const jobId = await handleUploadInvoiceFile({
    orgId,
    fileUrl,
    fileName,
    fileType,
    fileSizeBytes,
    ocrProvider: "google_vision",
    processingMode: "cloud",
  });

  try {
    const userContext = await extractUserContextFromRequest(request);
    const { recordUsageEvent } = await import("../usage");
    const { USAGE_FEATURES } = await import("../usage/usage-features");
    await recordUsageEvent({
      orgId,
      userId: userContext?.userId || null,
      featureId: USAGE_FEATURES.INVOICE_EXTRACTION_UPLOAD,
      metadata: { entityId: jobId, context: "api", fileType, fileSizeBytes },
    });
  } catch (e) {
    loggerService.warn("Usage event failed for invoice upload", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return { action: "upload", jobId };
}

async function handleExtractAction(
  request: CallableRequest<InvoiceExtractionPayload>,
  payload: { action: "extract" } & ExtractPayload
): Promise<InvoiceExtractionResponse> {
  const { jobId } = payload;
  if (!jobId) {
    throw new HttpsError("invalid-argument", "jobId is required");
  }

  const databaseService = getDatabaseService();
  const extractionJobRepository = getExtractionJobRepository(databaseService);
  const organizationRepository = getOrganizationRepository(databaseService);
  const job = await extractionJobRepository.get({ id: jobId });
  if (!job) {
    throw new HttpsError("not-found", `Extraction job not found: ${jobId}`);
  }
  await verifyAuthAndOrgMembership(request, job.orgId, {
    requiredRole: ORGANIZATION_ROLES.MEMBER,
  });

  const organization = await organizationRepository.get({ id: job.orgId });
  if (!organization) {
    throw new HttpsError("not-found", `Organization not found: ${job.orgId}`);
  }
  const runtimeOrganization = withRuntimeAiSelection(
    organization,
    AI_TASKS.invoiceDataExtraction,
    payload.ai
  );
  const aiConfig = configureAIProviderForTask({
    organization: runtimeOrganization,
    task: AI_TASKS.invoiceDataExtraction,
  });

  loggerService.info("Invoice extraction: extract", {
    jobId,
    orgId: job.orgId,
    provider: aiConfig.provider,
    model: aiConfig.model,
    providerSource: aiConfig.providerSource,
    modelSource: aiConfig.modelSource,
  });
  const updatedJob = await handleExtractInvoiceData(jobId);

  try {
    const userContext = await extractUserContextFromRequest(request);
    const { recordUsageEvent } = await import("../usage");
    const { USAGE_FEATURES } = await import("../usage/usage-features");
    await recordUsageEvent({
      orgId: job.orgId,
      userId: userContext?.userId || null,
      featureId: USAGE_FEATURES.INVOICE_EXTRACTION_PROCESS,
      metadata: {
        entityId: jobId,
        context: "api",
        processingDurationMs: updatedJob.processingDurationMs,
        extractedFieldCount: updatedJob.extractedData
          ? Object.keys(updatedJob.extractedData).length
          : 0,
      },
    });
  } catch (e) {
    loggerService.warn("Usage event failed for invoice extract", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return { action: "extract", job: updatedJob };
}

async function handleGenerateTemplateAction(
  request: CallableRequest<InvoiceExtractionPayload>,
  payload: { action: "generateTemplate" } & GenerateTemplatePayload
): Promise<InvoiceExtractionResponse> {
  const { jobId, editedData } = payload;
  if (!jobId) {
    throw new HttpsError("invalid-argument", "jobId is required");
  }

  const databaseService = getDatabaseService();
  const extractionJobRepository = getExtractionJobRepository(databaseService);
  const organizationRepository = getOrganizationRepository(databaseService);
  const job = await extractionJobRepository.get({ id: jobId });
  if (!job) {
    throw new HttpsError("not-found", `Extraction job not found: ${jobId}`);
  }
  await verifyAuthAndOrgMembership(request, job.orgId, {
    requiredRole: ORGANIZATION_ROLES.MEMBER,
  });

  const organization = await organizationRepository.get({ id: job.orgId });
  if (!organization) {
    throw new HttpsError("not-found", `Organization not found: ${job.orgId}`);
  }
  const runtimeOrganization = withRuntimeAiSelection(
    organization,
    AI_TASKS.invoiceTemplateFromExtractionGeneration,
    payload.ai
  );
  const aiConfig = configureAIProviderForTask({
    organization: runtimeOrganization,
    task: AI_TASKS.invoiceTemplateFromExtractionGeneration,
  });

  const normalizedOptions = normalizeGenerateTemplateOptions(payload);

  loggerService.info("Invoice extraction: generateTemplate", {
    jobId,
    orgId: job.orgId,
    provider: aiConfig.provider,
    model: aiConfig.model,
    providerSource: aiConfig.providerSource,
    modelSource: aiConfig.modelSource,
  });

  const generated = await handleGenerateTemplateFromInvoiceFile(
    jobId,
    normalizedOptions,
    editedData
  );

  try {
    const userContext = await extractUserContextFromRequest(request);
    const { recordUsageEvent } = await import("../usage");
    const { USAGE_FEATURES } = await import("../usage/usage-features");
    await recordUsageEvent({
      orgId: job.orgId,
      userId: userContext?.userId || null,
      featureId: USAGE_FEATURES.AI_INVOICE_TEMPLATE_GENERATE,
      metadata: {
        entityId: jobId,
        context: "api",
        templateName: generated.template.name,
        elementCount: generated.template.elements.length,
        needsReview: generated.needsReview,
        qualityOverall: generated.quality.overall,
      },
    });
  } catch (e) {
    loggerService.warn("Usage event failed for template generation", {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return {
    action: "generateTemplate",
    template: generated.template,
    quality: generated.quality,
    needsReview: generated.needsReview,
    reviewReasons: generated.reviewReasons,
  };
}

function normalizeGenerateTemplateOptions(
  payload: GenerateTemplatePayload
): GenerateTemplateOptions {
  return payload.options || {};
}

function withRuntimeAiSelection(
  organization: Organization,
  task: string,
  selection?: RuntimeAiSelection
): Organization {
  const provider = selection?.provider;
  const model = typeof selection?.model === "string" ? selection.model.trim() : "";
  const hasProvider =
    provider === "auto" || provider === "gemini" || provider === "openai";
  const hasModel = model.length > 0;

  if (!hasProvider && !hasModel) {
    return organization;
  }

  const existingAi = organization.settings?.ai || {};
  const existingRouting = existingAi.routing || {};
  const existingTasks = existingRouting.tasks || {};
  const existingTaskRule = existingTasks[task] || {};

  return {
    ...organization,
    settings: {
      ...organization.settings,
      ai: {
        ...existingAi,
        routing: {
          ...existingRouting,
          tasks: {
            ...existingTasks,
            [task]: {
              ...existingTaskRule,
              ...(hasProvider ? { provider } : {}),
              ...(hasModel ? { model } : {}),
            },
          },
        },
      },
    },
  };
}
