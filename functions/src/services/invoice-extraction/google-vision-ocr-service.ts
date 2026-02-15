import { ImageAnnotatorClient } from "@google-cloud/vision";
import { logger } from "firebase-functions";
import { getStorage } from "firebase-admin/storage";
import type { OCRService, OCRResult, OCRTextBlock, OCRWord } from "./ocr-service";

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
   * - PDFs: Multi-page PDF documents (uses asyncBatchAnnotateFiles)
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
      
      logger.info("Calling Google Cloud Vision API", {
        fileUrl,
        fileType,
        isPdf,
        gcsPath,
      });

      let response: any;

      if (isPdf) {
        // For PDFs, asyncBatchAnnotateFiles requires outputConfig
        // Instead, we'll use a simpler approach: process PDFs as images
        // This works better for most invoice PDFs and doesn't require output bucket setup
        
        // Extract bucket and path from GCS path
        const gcsMatch = gcsPath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
        if (!gcsMatch) {
          throw new Error(`Invalid GCS path format: ${gcsPath}`);
        }
        
        const bucket = gcsMatch[1];
        const outputPrefix = `ocr-results/${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const outputPath = `gs://${bucket}/${outputPrefix}`;

        const request = {
          inputConfig: {
            gcsSource: {
              uri: gcsPath,
            },
            mimeType: "application/pdf",
          },
          outputConfig: {
            gcsDestination: {
              uri: outputPath,
            },
            batchSize: 1, // Process one file at a time
          },
          features: [
            {
              type: "DOCUMENT_TEXT_DETECTION" as const,
            },
          ],
          imageContext: {
            // Support multiple languages including Bulgarian
            languageHints: ["en", "bg", "de", "fr", "es", "it"], // Common European languages
          },
        };

        try {
          // Start async batch annotation
          const [operation] = await this.client.asyncBatchAnnotateFiles({
            requests: [request],
          });

          // Wait for operation to complete
          await operation.promise();
          
          // After async batch completes, results are written to the output GCS location
          // We need to read the JSON result files from the output path
          const storage = getStorage();
          const outputBucket = storage.bucket(bucket);
          
          // List files in the output prefix
          const [outputFiles] = await outputBucket.getFiles({ prefix: outputPrefix });
          
          if (outputFiles.length === 0) {
            throw new Error("No output files found from PDF annotation");
          }

          // Read and parse all output files (may contain multiple JSON files)
          const allPages: any[] = [];
          let combinedFullText = "";
          
          for (const resultFile of outputFiles) {
            try {
              const [resultContent] = await resultFile.download();
              const resultJson = JSON.parse(resultContent.toString());
              
              logger.info("Parsing PDF annotation result file", {
                fileName: resultFile.name,
                hasResponses: !!resultJson.responses,
                responseCount: resultJson.responses?.length || 0,
              });

              // The result structure can vary - try different possible structures
              let responses: any[] = [];
              
              // Structure 1: Direct responses array
              if (Array.isArray(resultJson.responses)) {
                responses = resultJson.responses;
              }
              // Structure 2: Nested responses
              else if (resultJson.responses && Array.isArray(resultJson.responses)) {
                responses = resultJson.responses;
              }
              // Structure 3: Single response object
              else if (resultJson.fullTextAnnotation) {
                responses = [resultJson];
              }
              // Structure 4: Check if it's an AnnotateFileResponse directly
              else if (resultJson.responses && typeof resultJson.responses === 'object') {
                // It might be a single response object, wrap it
                responses = [resultJson.responses];
              }

              // Process each response
              for (const fileResponse of responses) {
                // Handle different response structures
                let pageResponses: any[] = [];
                
                if (fileResponse.responses && Array.isArray(fileResponse.responses)) {
                  pageResponses = fileResponse.responses;
                } else if (fileResponse.fullTextAnnotation) {
                  pageResponses = [fileResponse];
                } else if (fileResponse) {
                  pageResponses = [fileResponse];
                }
                
                for (const pageResponse of pageResponses) {
                  if (pageResponse.fullTextAnnotation) {
                    if (pageResponse.fullTextAnnotation.pages) {
                      allPages.push(...pageResponse.fullTextAnnotation.pages);
                    }
                    if (pageResponse.fullTextAnnotation.text) {
                      combinedFullText += pageResponse.fullTextAnnotation.text + "\n";
                    }
                  }
                }
              }
            } catch (fileError) {
              logger.warn("Failed to parse PDF annotation result file", {
                fileName: resultFile.name,
                error: fileError instanceof Error ? fileError.message : String(fileError),
              });
            }
          }
          
          // Clean up output files
          try {
            await Promise.all(outputFiles.map(file => file.delete()));
          } catch (cleanupError) {
            logger.warn("Failed to cleanup OCR output files", {
              error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
            });
          }

          if (combinedFullText.trim().length === 0) {
            logger.warn("No text found in PDF after parsing all result files", { 
              fileUrl,
              outputFileCount: outputFiles.length,
            });
            return {
              fullText: "",
              textBlocks: [],
              confidence: 0,
              pageCount: 1,
            };
          }

          // Create a response structure that matches image response format
          response = {
            fullTextAnnotation: {
              text: combinedFullText.trim(),
              pages: allPages,
            },
          };
        } catch (pdfError) {
          logger.error("PDF async batch annotation failed, trying fallback method", {
            error: pdfError instanceof Error ? pdfError.message : String(pdfError),
            fileUrl,
          });
          
          // Fallback: For smaller PDFs, try using the regular API with first page
          // This is a workaround for PDFs that fail with async batch
          throw new Error(`PDF processing failed: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}. Please try converting the PDF to images first.`);
        }
      } else {
        // For images, use regular annotateImage
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
            // Support multiple languages including Bulgarian
            languageHints: ["en", "bg", "de", "fr", "es", "it"], // Common European languages
          },
        };

        // Call Vision API for images
        [response] = await this.client.annotateImage(request);
      }

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
      const ocrWords: OCRWord[] = [];
      
      if (fullTextAnnotation.pages) {
        for (let pageIndex = 0; pageIndex < fullTextAnnotation.pages.length; pageIndex += 1) {
          const page = fullTextAnnotation.pages[pageIndex];
          const pageWidth = page.width || 1;
          const pageHeight = page.height || 1;

          if (page.blocks) {
            for (const block of page.blocks) {
              if (block.paragraphs) {
                for (const paragraph of block.paragraphs) {
                  if (paragraph.words) {
                    for (const word of paragraph.words) {
                      if (word.symbols && word.boundingBox) {
                        const wordText = word.symbols
                          .map((s: any) => s.text || "")
                          .join("");
                        
                        const boundingBox = word.boundingBox.vertices || [];
                        if (boundingBox.length >= 2) {
                          const x = boundingBox[0].x || 0;
                          const y = boundingBox[0].y || 0;
                          const width = (boundingBox[1].x || 0) - x;
                          const height = (boundingBox[3]?.y || boundingBox[2]?.y || 0) - y;
                          const normalizedX = Math.max(0, Math.min(1, x / pageWidth));
                          const normalizedY = Math.max(0, Math.min(1, y / pageHeight));
                          const normalizedWidth = Math.max(0, Math.min(1, Math.max(0, width) / pageWidth));
                          const normalizedHeight = Math.max(0, Math.min(1, Math.max(0, height) / pageHeight));

                          // Calculate confidence from word confidence or use default
                          const confidence = word.confidence || 0.8;
                          const safeText = wordText.trim();
                          if (!safeText) {
                            continue;
                          }
                          const id = `p${pageIndex}-w${ocrWords.length + 1}`;

                          textBlocks.push({
                            text: safeText,
                            confidence,
                            boundingBox: {
                              x,
                              y,
                              width: Math.max(0, width),
                              height: Math.max(0, height),
                            },
                          });

                          ocrWords.push({
                            id,
                            text: safeText,
                            confidence,
                            pageIndex,
                            boundingBox: {
                              x,
                              y,
                              width: Math.max(0, width),
                              height: Math.max(0, height),
                            },
                            normalizedBoundingBox: {
                              x: normalizedX,
                              y: normalizedY,
                              width: normalizedWidth,
                              height: normalizedHeight,
                            },
                            polygon: boundingBox
                              .filter((vertex: { x?: number; y?: number }) => typeof vertex?.x === "number" && typeof vertex?.y === "number")
                              .map((vertex: { x?: number; y?: number }) => ({
                                x: vertex.x || 0,
                                y: vertex.y || 0,
                              })),
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
        wordCount: ocrWords.length,
        confidence: overallConfidence,
        pageCount,
        durationMs,
      });

      return {
        fullText,
        textBlocks,
        ocrWords,
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
