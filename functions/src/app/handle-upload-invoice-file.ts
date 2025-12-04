import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { CreateExtractionJobInput, extractionJobDataSchema } from "../core/entities/invoice-extraction-job";
import { loggerService } from "../services/logger-service";
import { ZodError } from "zod";

/**
 * Application handler for uploading an invoice file and creating an extraction job.
 *
 * This handler:
 * 1. Validates the file upload payload
 * 2. Creates an extraction job with status "pending"
 * 3. Returns the extraction job ID
 *
 * @param {CreateExtractionJobInput} payload - The extraction job creation payload
 * @return {Promise<string>} The created extraction job ID
 * @throws Error if validation fails or database operation fails
 */
export async function handleUploadInvoiceFile(
  payload: CreateExtractionJobInput
): Promise<string> {
  try {
    // Validate the payload
    const validatedData = extractionJobDataSchema.parse({
      ...payload,
      status: payload.status || "pending",
    });

    // Get database service and repository
    const databaseService = getDatabaseService();
    const extractionJobRepository = getExtractionJobRepository(databaseService);

    // Create the extraction job
    const jobId = await extractionJobRepository.create({ data: validatedData });

    if (!jobId) {
      throw new Error("Failed to create extraction job: No ID returned");
    }

    loggerService.info("Extraction job created", {
      jobId,
      orgId: payload.orgId,
      fileName: payload.fileName,
      fileType: payload.fileType,
    });

    return jobId;
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new Error(
        `Extraction job validation failed: ${JSON.stringify(issues, null, 2)}`
      );
    }

    throw error;
  }
}

