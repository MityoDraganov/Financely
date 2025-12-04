import { ImageAnnotatorClient } from "@google-cloud/vision";
import { logger } from "firebase-functions";
import type { OCRService, OCRResult, OCRTextBlock } from "./ocr-service";

/**
 * Google Cloud Vision API OCR Service Implementation
 * 
 * Uses Google Cloud Vision API Document Text Detection for extracting
 * text and layout information from invoices (PDFs and images).
 * 
 * Features:
 * - Document Text Detection (for structured documents)
 * - Image Content Analysis
 * - Bounding box information
 * - Confidence scores
 * - Multi-page PDF support
 */
export class GoogleVisionOCRService implements OCRService {
  private client: ImageAnnotatorClient | null = null;
  private readonly projectId: string;

  constructor(projectId?: string) {
    this.projectId = projectId || process.env.GCLOUD_PROJECT || "";
    
    if (!this.projectId) {
      logger.warn("Google Cloud Vision OCR: No project ID provided, service will not be available");
      return;
    }

    try {
      this.client = new ImageAnnotatorClient({
        projectId: this.projectId,
      });
      logger.info("Google Cloud Vision OCR service initialized", {
        projectId: this.projectId,
      });
    } catch (error) {
      logger.error("Failed to initialize Google Cloud Vision OCR service", {
        error: error instanceof Error ? error.message : "Unknown error",
        projectId: this.projectId,
      });
    }
  }

  getName(): string {
    return "google_vision";
  }

  isAvailable(): boolean {
    return this.client !== null && this.projectId !== "";
  }

  /**
   * Extract text from a document using Google Cloud Vision API
   * 
   * Supports:
   * - Images: JPEG, PNG, GIF, BMP, WEBP
   * - PDFs: Multi-page PDF documents
   */
  async extractText(fileUrl: string, fileType: string): Promise<OCRResult> {
    if (!this.client) {
      throw new Error("Google Cloud Vision OCR service is not available");
    }

    const startTime = Date.now();

    try {
      // Determine if file is PDF or image
      const isPdf = fileType === "pdf" || fileUrl.toLowerCase().endsWith(".pdf");
      
      // Convert file URL to GCS path if needed
      const gcsPath = this.convertToGCSPath(fileUrl);
      
      // Prepare request
      const request = {
        image: {
          source: {
            imageUri: gcsPath,
          },
        },
        features: [
          {
            type: "DOCUMENT_TEXT_DETECTION" as const,  // Use document text detection for better layout
          },
        ],
        imageContext: {
          // Enable additional features for better extraction
          languageHints: ["en"],  // Can be extended to support multiple languages
        },
      };

      logger.info("Calling Google Cloud Vision API", {
        fileUrl,
        fileType,
        isPdf,
        gcsPath,
      });

      // Call Vision API
      const [response] = await this.client.annotateImage(request);

      if (!response.fullTextAnnotation) {
        logger.warn("No text found in document", { fileUrl });
        return {
          fullText: "",
          textBlocks: [],
          confidence: 0,
          pageCount: isPdf ? 1 : undefined,
        };
      }

      const fullTextAnnotation = response.fullTextAnnotation;
      const fullText = fullTextAnnotation.text || "";
      
      // Extract text blocks with bounding boxes
      const textBlocks: OCRTextBlock[] = [];
      
      if (fullTextAnnotation.pages) {
        for (const page of fullTextAnnotation.pages) {
          if (page.blocks) {
            for (const block of page.blocks) {
              if (block.paragraphs) {
                for (const paragraph of block.paragraphs) {
                  if (paragraph.words) {
                    for (const word of paragraph.words) {
                      if (word.symbols && word.boundingBox) {
                        const wordText = word.symbols
                          .map((s) => s.text || "")
                          .join("");
                        
                        const boundingBox = word.boundingBox.vertices || [];
                        if (boundingBox.length >= 2) {
                          const x = boundingBox[0].x || 0;
                          const y = boundingBox[0].y || 0;
                          const width = (boundingBox[1].x || 0) - x;
                          const height = (boundingBox[3]?.y || boundingBox[2]?.y || 0) - y;

                          // Calculate confidence from word confidence or use default
                          const confidence = word.confidence || 0.8;

                          textBlocks.push({
                            text: wordText,
                            confidence,
                            boundingBox: {
                              x,
                              y,
                              width: Math.max(0, width),
                              height: Math.max(0, height),
                            },
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Calculate overall confidence (average of word confidences or use page confidence)
      const overallConfidence = textBlocks.length > 0
        ? textBlocks.reduce((sum, block) => sum + block.confidence, 0) / textBlocks.length
        : fullTextAnnotation.pages?.[0]?.confidence || 0.8;

      const pageCount = isPdf ? fullTextAnnotation.pages?.length || 1 : undefined;

      const durationMs = Date.now() - startTime;

      logger.info("Google Cloud Vision OCR extraction completed", {
        fileUrl,
        textLength: fullText.length,
        textBlockCount: textBlocks.length,
        confidence: overallConfidence,
        pageCount,
        durationMs,
      });

      return {
        fullText,
        textBlocks,
        confidence: overallConfidence,
        language: fullTextAnnotation.pages?.[0]?.property?.detectedLanguages?.[0]?.languageCode || undefined,
        pageCount,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.error("Google Cloud Vision OCR extraction failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        fileUrl,
        fileType,
        durationMs,
      });
      throw new Error(
        `OCR extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Convert file URL to Google Cloud Storage path format
   * Handles both GCS URLs and HTTP URLs
   */
  private convertToGCSPath(fileUrl: string): string {
    // If already a GCS path (gs://bucket/path), return as-is
    if (fileUrl.startsWith("gs://")) {
      return fileUrl;
    }

    // If it's a Firebase Storage URL, convert to GCS path
    // Firebase Storage URLs: https://storage.googleapis.com/bucket/path
    // or https://firebasestorage.googleapis.com/v0/b/bucket/o/path
    const storageUrlMatch = fileUrl.match(
      /https:\/\/(?:storage\.googleapis\.com|firebasestorage\.googleapis\.com\/v0\/b)\/([^\/]+)\/o\/(.+)$/
    );
    
    if (storageUrlMatch) {
      const bucket = storageUrlMatch[1];
      const path = decodeURIComponent(storageUrlMatch[2].replace(/%2F/g, "/"));
      return `gs://${bucket}/${path}`;
    }

    // If it's a storage.googleapis.com URL
    const gcsUrlMatch = fileUrl.match(/https:\/\/storage\.googleapis\.com\/([^\/]+)\/(.+)$/);
    if (gcsUrlMatch) {
      const bucket = gcsUrlMatch[1];
      const path = gcsUrlMatch[2];
      return `gs://${bucket}/${path}`;
    }

    // For other URLs, try to extract bucket from Firebase Storage
    // This is a fallback - ideally files should be in Firebase Storage
    logger.warn("File URL is not a recognized GCS format, using as-is", {
      fileUrl,
    });
    
    return fileUrl;
  }
}

/**
 * Get or create Google Vision OCR service instance
 */
let googleVisionOCRServiceInstance: GoogleVisionOCRService | null = null;

export function getGoogleVisionOCRService(projectId?: string): GoogleVisionOCRService {
  if (!googleVisionOCRServiceInstance) {
    googleVisionOCRServiceInstance = new GoogleVisionOCRService(projectId);
  }
  return googleVisionOCRServiceInstance;
}

