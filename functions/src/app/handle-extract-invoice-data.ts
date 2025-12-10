import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { ExtractionJob } from "../core/entities/invoice-extraction-job";
import { getGoogleVisionOCRService } from "../services/invoice-extraction/google-vision-ocr-service";
import { getAIService } from "../services/ai/ai-service";
import type { JSONSchema } from "../services/ai/ai-service";
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
      fileType: job.fileType,
      hasText: ocrResult.fullText.trim().length > 0,
    });

    // Check if OCR returned empty text
    if (!ocrResult.fullText || ocrResult.fullText.trim().length === 0) {
      loggerService.warn("OCR extraction returned empty text", {
        jobId,
        fileType: job.fileType,
        confidence: ocrResult.confidence,
        textBlockCount: ocrResult.textBlocks.length,
      });
    }

    // Use AI to structure the extracted data (only if we have OCR text)
    let structuredData: Record<string, unknown> | null = null;
    
    if (ocrResult.fullText && ocrResult.fullText.trim().length > 0) {
      const aiService = getAIService();
      structuredData = await extractStructuredData(
        ocrResult.fullText,
        aiService
      );
      
      loggerService.info("AI structured data extraction completed", {
        jobId,
        extractedFieldCount: structuredData ? Object.keys(structuredData).length : 0,
        hasData: !!structuredData,
      });
    } else {
      loggerService.warn("Skipping AI extraction - OCR text is empty", { jobId });
    }

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
          // Store textBlocks here as backup (in case ocrTextBlocks field isn't available)
          textBlocks: ocrResult.textBlocks,
        },
        // Store OCR text blocks for template generation from layout
        ocrTextBlocks: ocrResult.textBlocks,
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
    // Check if OCR text is empty
    if (!ocrText || ocrText.trim().length === 0) {
      loggerService.warn("OCR text is empty, cannot extract structured data");
      return null;
    }

    const prompt = `Extract ALL structured data from the following invoice OCR text. The text may be in any language (English, Bulgarian, German, French, Spanish, Italian, etc.). 

OCR Text:
${ocrText}

Instructions:
1. Extract ALL fields and information you find in the invoice - be comprehensive and dynamic
2. Recognize field labels in multiple languages (English, Bulgarian, German, French, Spanish, Italian, etc.)
3. Use appropriate field names based on what you find (e.g., "invoiceNumber", "invoiceNo", "factura", "номер", etc.)
4. For dates, parse and convert to YYYY-MM-DD format regardless of source format
5. For amounts, extract numbers (remove currency symbols, handle decimal separators correctly)
6. For Bulgarian invoices: recognize Cyrillic text and common Bulgarian invoice terms
7. Extract nested objects where appropriate (e.g., seller: {name, address, taxId}, buyer: {name, address, taxId})
8. Extract line items as arrays with all available fields (description, quantity, unitPrice, total, etc.)
9. Include any additional fields you find (payment terms, notes, references, etc.)
10. Return a valid JSON object with all extracted data
11. Use null only for truly missing values, otherwise extract what you can find
12. Preserve the structure and relationships in the data

Return a comprehensive JSON object with all invoice data you can extract. Be dynamic - extract whatever fields are present, don't limit yourself to a predefined set.`;

    // Use a minimal schema that allows any structure - fully dynamic extraction
    // Just specify it's an object, and the AI will extract whatever fields it finds
    const schema: JSONSchema = {
      type: "object",
      // No properties defined - allows AI to extract any fields dynamically
    };

    const result = await aiService.generateJSON<Record<string, unknown>>(
      prompt,
      schema,
      {
        temperature: 0.2, // Lower temperature for more consistent extraction
        maxTokens: 4000, // Increased for more comprehensive extraction
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

