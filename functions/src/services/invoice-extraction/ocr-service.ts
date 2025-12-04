/**
 * OCR Service Interface
 * 
 * Abstract interface for OCR providers to extract text and layout information
 * from invoice documents (PDFs and images).
 */

export interface OCRTextBlock {
  text: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OCRResult {
  fullText: string;
  textBlocks: OCRTextBlock[];
  confidence: number;
  language?: string;
  pageCount?: number;  // For PDFs
}

export interface OCRService {
  /**
   * Extract text and layout from a document
   * 
   * @param fileUrl - URL to the file (can be GCS URL or HTTP URL)
   * @param fileType - MIME type of the file
   * @returns OCR result with text, blocks, and confidence scores
   */
  extractText(fileUrl: string, fileType: string): Promise<OCRResult>;
  
  /**
   * Get the name of the OCR provider
   */
  getName(): string;
  
  /**
   * Check if the service is available/configured
   */
  isAvailable(): boolean;
}

