import { getDatabaseService } from "../services/database-service";
import { getExtractionJobRepository } from "../repositories/extraction-job-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { ExtractionJob } from "../core/entities/invoice-extraction-job";
import { getGoogleVisionOCRService } from "../services/invoice-extraction/google-vision-ocr-service";
import { getAIService } from "../services/ai/ai-service";
import type { JSONSchema } from "../services/ai/ai-service";
import { loggerService } from "../services/logger-service";
import type { OCRWord } from "../services/invoice-extraction/ocr-service";
import {
  DEFAULT_TEMPLATE_QUALITY,
  type DocumentPage,
  type FontMatch,
  type VisionLayout,
} from "../services/invoice-extraction/pipeline-types";
import { getPdfPageRendererService } from "../services/invoice-extraction/pdf-page-renderer-service";
import { getInvoiceLayoutVisionService } from "../services/invoice-extraction/invoice-layout-vision-service";
import { getLayoutFusionService } from "../services/invoice-extraction/layout-fusion-service";
import { getFontMatchingService } from "../services/invoice-extraction/font-matching-service";
import { getAssetCroppingService } from "../services/invoice-extraction/asset-cropping-service";

const isImageFileType = (fileType: string): boolean => fileType !== "pdf";

/**
 * Application handler for extracting invoice data from an uploaded file.
 * layout_fusion_v2 pipeline: OCR + vision layout + fusion + font matching + review quality.
 */
export async function handleExtractInvoiceData(
  jobId: string
): Promise<ExtractionJob> {
  const startTime = Date.now();
  const databaseService = getDatabaseService();
  const extractionJobRepository = getExtractionJobRepository(databaseService);
  const organizationRepository = getOrganizationRepository(databaseService);

  try {
    const job = await extractionJobRepository.get({ id: jobId });
    if (!job) {
      throw new Error(`Extraction job not found: ${jobId}`);
    }

    if (job.status !== "pending") {
      return job;
    }

    await extractionJobRepository.update({
      id: jobId,
      data: { status: "processing" },
    });

    loggerService.info("Starting invoice extraction", {
      jobId,
      orgId: job.orgId,
      fileType: job.fileType,
      pipeline: "layout_fusion_v2",
    });

    const organization = await organizationRepository.get({ id: job.orgId });
    if (!organization) {
      throw new Error(`Organization not found: ${job.orgId}`);
    }

    const ocrService = getGoogleVisionOCRService();
    if (!ocrService.isAvailable()) {
      throw new Error("Google Cloud Vision OCR service is not available");
    }

    const ocrResult = await ocrService.extractText(job.fileUrl, job.fileType);

    const ocrWords = normalizeOcrWords(
      ocrResult.ocrWords,
      ocrResult.textBlocks,
      ocrResult.pageCount || 1
    );

    let documentPages: DocumentPage[] = [];
    if (isImageFileType(job.fileType)) {
      const pageSize = derivePageSizeFromWords(ocrWords);
      documentPages = [{
        pageIndex: 0,
        width: pageSize.width,
        height: pageSize.height,
        imageUrl: job.fileUrl,
        mimeType: job.fileType,
        source: "original",
      }];
    } else {
      const renderer = getPdfPageRendererService();
      documentPages = await renderer.renderPages({
        fileUrl: job.fileUrl,
        orgId: job.orgId,
        jobId,
        maxPages: 5,
      });

      if (documentPages.length === 0) {
        const pageSize = derivePageSizeFromWords(ocrWords);
        documentPages = [{
          pageIndex: 0,
          width: pageSize.width,
          height: pageSize.height,
          imageUrl: job.fileUrl,
          mimeType: "application/pdf",
          source: "rendered_pdf",
        }];
      }
    }

    const resolvedPageCount = ocrResult.pageCount ?? Math.max(1, documentPages.length);

    const ocrRawResults: Record<string, unknown> = {
      fullText: ocrResult.fullText,
      textBlockCount: ocrResult.textBlocks.length,
      wordCount: ocrWords.length,
      overallConfidence: ocrResult.confidence,
      pageCount: resolvedPageCount,
      textBlocks: ocrResult.textBlocks,
    };

    const aiService = getAIService();

    let structuredData: Record<string, unknown> | null = null;
    if (ocrResult.fullText && ocrResult.fullText.trim().length > 0) {
      structuredData = await extractStructuredData(ocrResult.fullText, aiService);
    }

    if (structuredData == null) {
      structuredData = { rawText: ocrResult.fullText || "" };
    }

    let visionLayout: VisionLayout = {
      regions: [],
      elements: [],
      tables: [],
      styleClusters: [],
    };

    try {
      const visionService = getInvoiceLayoutVisionService();
      visionLayout = await visionService.analyzeDocument({
        pages: documentPages.filter((page) => page.imageUrl.startsWith("http")),
        ocrWords,
        maxPages: 5,
      });
    } catch (error) {
      loggerService.warn("Vision layout analysis failed for extraction job", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    let fontMatches: FontMatch[] = [];
    try {
      const fontMatchingService = getFontMatchingService();
      fontMatches = await fontMatchingService.matchFonts({
        pages: documentPages,
        visionLayout,
      });
    } catch (error) {
      loggerService.warn("Font matching failed for extraction job", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      fontMatches = [];
    }

    const layoutFusionService = getLayoutFusionService();
    const fusion = layoutFusionService.fuse({
      extractedData: structuredData,
      ocrWords,
      visionLayout,
      fontMatches,
    });

    let croppedAssets: Array<{
      id: string;
      pageIndex: number;
      kind: "logo" | "image";
      imageUrl: string;
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence: number;
    }> = [];

    try {
      const assetCroppingService = getAssetCroppingService();
      croppedAssets = await assetCroppingService.cropAssets({
        orgId: job.orgId,
        jobId,
        pages: documentPages,
        visionLayout,
        maxAssets: 8,
      });
    } catch (error) {
      loggerService.warn("Asset cropping failed for extraction job", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      croppedAssets = [];
    }

    const confidenceScores: Record<string, number> = {};
    for (const entry of fusion.fusionMap) {
      confidenceScores[entry.binding] = entry.confidence;
    }

    if (Object.keys(confidenceScores).length === 0) {
      for (const key of Object.keys(structuredData)) {
        confidenceScores[key] = 0.6;
      }
    }

    const processingDurationMs = Date.now() - startTime;

    const safeExtractionUpdate = stripUndefinedDeep({
      status: "extracted" as const,
      extractedData: structuredData,
      confidenceScores,
      ocrRawResults,
      ocrTextBlocks: ocrResult.textBlocks,
      documentPages,
      ocrWords,
      visionLayout,
      fusionMap: fusion.fusionMap,
      fontMatches,
      croppedAssets,
      quality: fusion.quality || DEFAULT_TEMPLATE_QUALITY,
      needsReview: fusion.needsReview,
      reviewReasons: fusion.reviewReasons,
      processingDurationMs,
    });

    await extractionJobRepository.update({
      id: jobId,
      data: safeExtractionUpdate,
    });

    const updatedJob = await extractionJobRepository.get({ id: jobId });
    if (!updatedJob) {
      throw new Error("Failed to retrieve updated extraction job");
    }

    loggerService.info("Invoice extraction completed", {
      jobId,
      processingDurationMs,
      extractedFieldCount: Object.keys(structuredData).length,
      ocrWordCount: ocrWords.length,
      visionElements: visionLayout.elements.length,
      needsReview: fusion.needsReview,
      qualityOverall: fusion.quality.overall,
    });

    return updatedJob;
  } catch (error) {
    const processingDurationMs = Date.now() - startTime;

    try {
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
 * Use AI to extract structured invoice data from OCR text.
 */
async function extractStructuredData(
  ocrText: string,
  aiService: ReturnType<typeof getAIService>
): Promise<Record<string, unknown> | null> {
  try {
    if (!ocrText || ocrText.trim().length === 0) {
      loggerService.warn("OCR text is empty, cannot extract structured data");
      return null;
    }

    const prompt = `Extract ALL structured data from the following invoice OCR text. The text may be in any language (English, Bulgarian, German, French, Spanish, Italian, etc.).

OCR Text:
${ocrText}

Instructions:
1. Extract all fields and information you find in the invoice.
2. Recognize multilingual field labels and preserve meaningful field names.
3. Convert dates to YYYY-MM-DD where possible.
4. Extract numeric amounts (normalize separators where possible).
5. Support nested objects for seller, buyer, invoice metadata.
6. Extract line items arrays with all available fields.
7. Include payment terms, references, notes when present.
8. Return strictly valid JSON object.
9. Use null only when data is truly missing.`;

    const schema: JSONSchema = {
      type: "object",
    };

    const result = await aiService.generateJSON<Record<string, unknown>>(
      prompt,
      schema,
      {
        temperature: 0.2,
        maxTokens: 4000,
      }
    );

    return result;
  } catch (error) {
    loggerService.error("Failed to extract structured data with AI", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

function normalizeOcrWords(
  words: OCRWord[] | undefined,
  textBlocks: Array<{ text: string; confidence: number; boundingBox: { x: number; y: number; width: number; height: number } }>,
  pageCount: number
): OCRWord[] {
  if (words && words.length > 0) {
    return words;
  }

  const pageSafeCount = Math.max(1, pageCount);
  const syntheticWords: OCRWord[] = [];

  for (let index = 0; index < textBlocks.length; index += 1) {
    const block = textBlocks[index];
    const pageIndex = index % pageSafeCount;
    syntheticWords.push({
      id: `synthetic-${index + 1}`,
      text: block.text,
      confidence: block.confidence,
      pageIndex,
      boundingBox: block.boundingBox,
      normalizedBoundingBox: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
      polygon: [],
    });
  }

  return syntheticWords;
}

function derivePageSizeFromWords(words: OCRWord[]): { width: number; height: number } {
  if (words.length === 0) {
    return { width: 1240, height: 1754 };
  }

  const maxX = Math.max(...words.map((word) => word.boundingBox.x + word.boundingBox.width));
  const maxY = Math.max(...words.map((word) => word.boundingBox.y + word.boundingBox.height));

  return {
    width: Math.max(600, Math.ceil(maxX + 20)),
    height: Math.max(900, Math.ceil(maxY + 20)),
  };
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (nestedValue === undefined) {
        continue;
      }
      const normalized = stripUndefinedDeep(nestedValue);
      if (normalized !== undefined) {
        output[key] = normalized;
      }
    }
    return output as T;
  }

  return value;
}
