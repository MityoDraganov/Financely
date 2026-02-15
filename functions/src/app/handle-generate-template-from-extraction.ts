import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getTemplateFromExtractionService } from "../services/invoice-extraction/template-from-extraction-service";
import { TemplateData } from "../core/entities/template";
import { loggerService } from "../services/logger-service";
import { DEFAULT_TEMPLATE_QUALITY, type TemplateQuality } from "../services/invoice-extraction/pipeline-types";

export type GenerateTemplateFromExtractionResult = {
  template: TemplateData;
  quality: TemplateQuality;
  needsReview: boolean;
  reviewReasons: string[];
};

/**
 * Application handler for generating an invoice template from extracted invoice data.
 * Supports editedData override and returns quality/review metadata for UI gating.
 */
export async function handleGenerateTemplateFromExtraction(
  jobId: string,
  options?: {
    style?: "modern" | "classic" | "minimal" | "professional";
    templateName?: string;
    strategy?: "layout_fusion_v2" | "legacy";
    qualityTarget?: "pixel";
  },
  editedData?: Record<string, unknown>
): Promise<GenerateTemplateFromExtractionResult> {
  const databaseService = getDatabaseService();
  const extractionJobRepository = getExtractionJobRepository(databaseService);
  const organizationRepository = getOrganizationRepository(databaseService);

  const job = await extractionJobRepository.get({ id: jobId });
  if (!job) {
    throw new Error(`Extraction job not found: ${jobId}`);
  }

  const organization = await organizationRepository.get({ id: job.orgId });
  if (!organization) {
    throw new Error(`Organization not found: ${job.orgId}`);
  }

  let workingJob = job;

  if (editedData && Object.keys(editedData).length > 0) {
    loggerService.info("Applying edited extraction data for template generation", {
      jobId,
      editedFieldCount: Object.keys(editedData).length,
    });

    await extractionJobRepository.update({
      id: jobId,
      data: {
        correctedData: editedData,
        extractedData: editedData,
      },
    });

    const refreshedJob = await extractionJobRepository.get({ id: jobId });
    if (!refreshedJob) {
      throw new Error(`Extraction job not found after update: ${jobId}`);
    }
    workingJob = refreshedJob;
  }

  if (
    !editedData &&
    workingJob.generatedTemplate &&
    typeof workingJob.generatedTemplate === "object" &&
    Array.isArray((workingJob.generatedTemplate as Record<string, unknown>).elements)
  ) {
    loggerService.info("Returning cached generatedTemplate from job", { jobId });
    return {
      template: workingJob.generatedTemplate as unknown as TemplateData,
      quality: (workingJob.quality as TemplateQuality | undefined) || DEFAULT_TEMPLATE_QUALITY,
      needsReview: Boolean(workingJob.needsReview),
      reviewReasons: workingJob.reviewReasons || [],
    };
  }

  if (!workingJob.extractedData || Object.keys(workingJob.extractedData).length === 0) {
    throw new Error(`Extraction job ${jobId} has no extracted data. Please extract data first.`);
  }

  loggerService.info("Generating template from extraction job", {
    jobId,
    orgId: workingJob.orgId,
    strategy: options?.strategy || null,
    qualityTarget: options?.qualityTarget || null,
  });

  const templateGenerationService = getTemplateFromExtractionService();
  const template = await templateGenerationService.generateTemplateFromExtraction(workingJob, organization, options);

  const quality = (workingJob.quality as TemplateQuality | undefined) || DEFAULT_TEMPLATE_QUALITY;
  const needsReview = Boolean(workingJob.needsReview);
  const reviewReasons = workingJob.reviewReasons || [];

  await extractionJobRepository.update({
    id: jobId,
    data: {
      generatedTemplate: template as unknown as Record<string, unknown>,
    },
  });

  return {
    template,
    quality,
    needsReview,
    reviewReasons,
  };
}
