import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getTemplateFromExtractionService } from "../services/invoice-extraction/template-from-extraction-service";
import { TemplateData } from "../core/entities/template";
import { loggerService } from "../services/logger-service";

/**
 * Application handler for generating an invoice template from extracted invoice data
 * 
 * @param jobId - The extraction job ID
 * @param options - Optional template generation options
 * @returns The generated template data
 */
export async function handleGenerateTemplateFromExtraction(
  jobId: string,
  options?: {
    style?: "modern" | "classic" | "minimal" | "professional";
    templateName?: string;
  }
): Promise<TemplateData> {
  const databaseService = getDatabaseService();
  const extractionJobRepository = getExtractionJobRepository(databaseService);
  const organizationRepository = getOrganizationRepository(databaseService);

  // Get the extraction job
  const job = await extractionJobRepository.get({ id: jobId });
  if (!job) {
    throw new Error(`Extraction job not found: ${jobId}`);
  }

  // Verify job has extracted data
  if (!job.extractedData || Object.keys(job.extractedData).length === 0) {
    throw new Error(`Extraction job ${jobId} has no extracted data. Please extract data first.`);
  }

  // Log OCR blocks availability for debugging
  loggerService.info("Extraction job retrieved for template generation", {
    jobId,
    hasOcrTextBlocks: !!job.ocrTextBlocks,
    ocrTextBlocksCount: job.ocrTextBlocks?.length || 0,
    hasExtractedData: !!job.extractedData,
    extractedDataKeys: Object.keys(job.extractedData || {}),
  });

  // Get the organization
  const organization = await organizationRepository.get({ id: job.orgId });
  if (!organization) {
    throw new Error(`Organization not found: ${job.orgId}`);
  }

  loggerService.info("Generating template from extraction", {
    jobId,
    orgId: job.orgId,
    extractedFieldCount: Object.keys(job.extractedData).length,
    style: options?.style,
  });

  // Generate template
  const templateGenerationService = getTemplateFromExtractionService();
  const template = await templateGenerationService.generateTemplateFromExtraction(
    job,
    organization,
    options
  );

  // Note: Success log is already in the service, no need to duplicate

  return template;
}

