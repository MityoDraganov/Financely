import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { ExtractionJob } from "../core/entities/invoice-extraction-job";
import { getGoogleVisionOCRService } from "../services/invoice-extraction/google-vision-ocr-service";
import { getAIService } from "../services/ai/ai-service";
import { loggerService } from "../services/logger-service";

/**
 * Application handler for extracting invoice data from an uploaded file.
 *
 * This handler:
 * 1. Retrieves the extraction job
 * 2. Calls Google Cloud Vision API for OCR
 * 3. Uses AI (Gemini) to structure the extracted data
 * 4. Updates the extraction job with results
 *
 * @param {string} jobId - The extraction job ID
 * @return {Promise<ExtractionJob>} The updated extraction job
 * @throws Error if extraction fails
 */
export async function handleExtractInvoiceData(
  jobId: string
): Promise<ExtractionJob> {
  const startTime = Date.now();

  try {
    // Get database service and repository
    const databaseService = getDatabaseService();
    const extractionJobRepository = getExtractionJobRepository(databaseService);

    // Get the extraction job
    const job = await extractionJobRepository.get({ id: jobId });
    if (!job) {
      throw new Error(`Extraction job not found: ${jobId}`);
    }

    if (job.status !== "pending") {
      throw new Error(`Extraction job is not in pending status: ${job.status}`);
    }

    // Update status to processing
    await extractionJobRepository.update({
      id: jobId,
      data: {
        status: "processing",
      },
    });

    loggerService.info("Starting invoice extraction", {
      jobId,
      orgId: job.orgId,
      fileUrl: job.fileUrl,
      fileType: job.fileType,
    });

    // Initialize OCR service
    const ocrService = getGoogleVisionOCRService();
    if (!ocrService.isAvailable()) {
      throw new Error("Google Cloud Vision OCR service is not available");
    }

    // Perform OCR extraction
    const ocrResult = await ocrService.extractText(job.fileUrl, job.fileType);

    loggerService.info("OCR extraction completed", {
      jobId,
      textLength: ocrResult.fullText.length,
      textBlockCount: ocrResult.textBlocks.length,
      confidence: ocrResult.confidence,
    });

    // Use AI to structure the extracted data
    const aiService = getAIService();
    const structuredData = await extractStructuredData(
      ocrResult.fullText,
      aiService
    );

    // Calculate confidence scores from OCR results
    const confidenceScores: Record<string, number> = {};
    if (structuredData) {
      // Use OCR confidence as base, can be refined with AI confidence later
      Object.keys(structuredData).forEach((key) => {
        confidenceScores[key] = ocrResult.confidence;
      });
    }

    const processingDurationMs = Date.now() - startTime;

    // Update extraction job with results
    await extractionJobRepository.update({
      id: jobId,
      data: {
        status: "extracted",
        extractedData: structuredData || undefined, // Convert null to undefined
        confidenceScores,
        ocrRawResults: {
          fullText: ocrResult.fullText,
          textBlockCount: ocrResult.textBlocks.length,
          overallConfidence: ocrResult.confidence,
        },
        processingDurationMs,
      },
    });

    // Get updated job
    const updatedJob = await extractionJobRepository.get({ id: jobId });
    if (!updatedJob) {
      throw new Error("Failed to retrieve updated extraction job");
    }

    loggerService.info("Invoice extraction completed", {
      jobId,
      processingDurationMs,
      extractedFieldCount: structuredData ? Object.keys(structuredData).length : 0,
    });

    return updatedJob;
  } catch (error) {
    const processingDurationMs = Date.now() - startTime;
    
    // Update job status to failed
    try {
      const databaseService = getDatabaseService();
      const extractionJobRepository = getExtractionJobRepository(databaseService);
      
      await extractionJobRepository.update({
        id: jobId,
        data: {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          processingDurationMs,
        },
      });
    } catch (updateError) {
      loggerService.error("Failed to update extraction job status to failed", {
        jobId,
        error: updateError instanceof Error ? updateError.message : "Unknown error",
      });
    }

    loggerService.error("Invoice extraction failed", {
      jobId,
      error: error instanceof Error ? error.message : "Unknown error",
      processingDurationMs,
    });

    throw error;
  }
}

/**
 * Use AI to extract structured invoice data from OCR text
 */
async function extractStructuredData(
  ocrText: string,
  aiService: ReturnType<typeof getAIService>
): Promise<Record<string, unknown> | null> {
  try {
    const prompt = `Extract structured invoice data from the following OCR text. Return a JSON object with common invoice fields.

OCR Text:
${ocrText}

Extract the following fields if present:
- invoiceNumber (or invoice number, invoice #, etc.)
- issueDate (or date, invoice date, etc.)
- dueDate (or due date, payment due, etc.)
- seller.name (or vendor name, from, supplier, etc.)
- seller.address (or vendor address, supplier address, etc.)
- seller.taxIdVat (or VAT ID, tax ID, EIN, etc.)
- buyer.name (or customer name, bill to, client, etc.)
- buyer.address (or customer address, bill to address, etc.)
- buyer.taxIdVat (or customer VAT ID, etc.)
- subtotal (or subtotal, net amount, etc.)
- vatTotal (or VAT total, tax total, etc.)
- total (or total amount, grand total, amount due, etc.)
- items (array of line items with: description, quantity/qty, unitPrice/price, total/lineTotal)

Return only valid JSON. Use null for missing fields. For dates, use YYYY-MM-DD format. For amounts, use numbers (not strings).`;

    const schema = {
      type: "object" as const,
      properties: {
        invoiceNumber: { type: "string" as const },
        issueDate: { type: "string" as const },
        dueDate: { type: "string" as const },
        seller: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
            address: { type: "string" as const },
            taxIdVat: { type: "string" as const },
          },
        },
        buyer: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const },
            address: { type: "string" as const },
            taxIdVat: { type: "string" as const },
          },
        },
        subtotal: { type: "number" as const },
        vatTotal: { type: "number" as const },
        total: { type: "number" as const },
        items: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              description: { type: "string" as const },
              quantity: { type: "number" as const },
              unitPrice: { type: "number" as const },
              total: { type: "number" as const },
            },
          },
        },
      },
    };

    const result = await aiService.generateJSON<Record<string, unknown>>(
      prompt,
      schema,
      {
        temperature: 0.3, // Lower temperature for more consistent extraction
        maxTokens: 2000,
      }
    );

    return result;
  } catch (error) {
    loggerService.error("Failed to extract structured data with AI", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // Return null to allow manual entry
    return null;
  }
}

