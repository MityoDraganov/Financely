import { logger } from "firebase-functions";
import { TemplateData, TemplateElement } from "../../core/entities/template";
import { ExtractionJob } from "../../core/entities/invoice-extraction-job";
import { Organization } from "../../core/entities/organization";
import { OCRTextBlock } from "./ocr-service";
import { invoiceComplianceService } from "../invoice-compliance-service";
import { COMPLIANCE_SCHEMAS } from "../../core/entities/invoice-compliance";

/**
 * Service for converting OCR text blocks directly to template elements
 * 
 * This is more efficient than AI generation because:
 * 1. Uses actual OCR layout positions (preserves original invoice layout)
 * 2. Faster (minimal AI processing)
 * 3. More accurate (real positions, not guessed)
 * 4. Better UX (template matches original invoice)
 */
export class OCRToTemplateService {
  /**
   * Convert OCR text blocks to template elements
   * Maps extracted data fields to OCR blocks and creates template elements
   */
  convertOCRToTemplate(
    extractionJob: ExtractionJob,
    organization: Organization,
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional";
      templateName?: string;
    }
  ): TemplateData {
    if (!extractionJob.ocrTextBlocks || extractionJob.ocrTextBlocks.length === 0) {
      throw new Error("No OCR text blocks available for template generation");
    }

    if (!extractionJob.extractedData || Object.keys(extractionJob.extractedData).length === 0) {
      throw new Error("No extracted data available for template generation");
    }

    const ocrBlocks = extractionJob.ocrTextBlocks;
    const extractedData = extractionJob.extractedData;

    // Detect compliance region
    const region = invoiceComplianceService.detectRegion(organization);
    const complianceSchema = COMPLIANCE_SCHEMAS[region];

    // Determine currency
    const regionCurrencyMap: Record<"US" | "EU" | "CA" | "AU" | "UK", string> = {
      US: "USD",
      EU: "EUR",
      CA: "CAD",
      AU: "AUD",
      UK: "GBP",
    };
    const currency = organization.settings?.defaultCurrency || regionCurrencyMap[region] || "USD";

    // Map extracted fields to OCR blocks
    const fieldMappings = this.mapFieldsToOCRBlocks(extractedData, ocrBlocks);

    logger.info("Field to OCR block mapping completed", {
      extractionJobId: extractionJob.id,
      totalFields: Object.keys(extractedData).length,
      mappedFields: fieldMappings.size,
      ocrBlockCount: ocrBlocks.length,
    });

    // Convert OCR blocks to template elements
    const elements = this.convertBlocksToElements(
      ocrBlocks,
      fieldMappings,
      extractedData,
      currency
    );

    logger.info("OCR to template conversion completed", {
      extractionJobId: extractionJob.id,
      elementCount: elements.length,
      mappedFields: fieldMappings.size,
    });

    // If no elements were created, throw error with details
    if (elements.length === 0) {
      logger.error("OCR-to-template conversion produced no elements", {
        extractionJobId: extractionJob.id,
        ocrBlockCount: ocrBlocks.length,
        extractedFieldCount: Object.keys(extractedData).length,
        mappedFieldCount: fieldMappings.size,
        sampleOCRBlocks: ocrBlocks.slice(0, 5).map(b => ({
          text: b.text.substring(0, 50),
          x: b.boundingBox.x,
          y: b.boundingBox.y,
        })),
        sampleExtractedFields: Object.keys(extractedData).slice(0, 10),
      });
      throw new Error(
        `OCR-to-template conversion failed: No elements created. ` +
        `OCR blocks: ${ocrBlocks.length}, Mapped fields: ${fieldMappings.size}, ` +
        `Extracted fields: ${Object.keys(extractedData).length}. ` +
        `This might indicate that field-to-block mapping failed. Falling back to AI generation.`
      );
    }

    // Build template data
    const template: TemplateData = {
      orgId: organization.id,
      name: options?.templateName || `Template from ${extractionJob.fileName}`,
      description: `Template generated from extracted invoice: ${extractionJob.fileName}`,
      pageSize: "A4", // Default, can be detected from OCR if needed
      brand: {
        fonts: ["Inter"],
        colors: {
          primary: organization.settings?.brandColors?.primary || "#111827",
          secondary: organization.settings?.brandColors?.secondary || "#6b7280",
          accent: organization.settings?.brandColors?.accent || "#2563eb",
        },
        margins: { top: 40, right: 40, bottom: 40, left: 40 },
      },
      elements,
      status: "draft",
      compliance: {
        region,
        requiredFields: complianceSchema.requiredFields.map(f => f.binding),
        autoFooter: true,
        complianceValidated: false,
      },
    };

    logger.info("Template generated from OCR layout", {
      extractionJobId: extractionJob.id,
      organizationId: organization.id,
      elementCount: elements.length,
      ocrBlockCount: ocrBlocks.length,
    });

    return template;
  }

  /**
   * Map extracted data fields to OCR text blocks
   * Uses text matching to find which OCR blocks contain which fields
   */
  private mapFieldsToOCRBlocks(
    extractedData: Record<string, unknown>,
    ocrBlocks: OCRTextBlock[]
  ): Map<string, OCRTextBlock[]> {
    const mappings = new Map<string, OCRTextBlock[]>();

    // Helper to find OCR blocks containing a value
    const findBlocksForValue = (value: unknown, fieldPath: string): OCRTextBlock[] => {
      if (value === null || value === undefined) return [];

      const searchText = String(value).toLowerCase().trim();
      if (searchText.length === 0) return [];

      // Try exact match first
      let matches = ocrBlocks.filter(block => {
        const blockText = block.text.toLowerCase().trim();
        return blockText === searchText;
      });

      // If no exact match, try partial match
      if (matches.length === 0) {
        matches = ocrBlocks.filter(block => {
          const blockText = block.text.toLowerCase();
          // Check if block text contains the value or vice versa
          return blockText.includes(searchText) || searchText.includes(blockText);
        });
      }

      // If still no match, try fuzzy matching (for numbers, dates, etc.)
      if (matches.length === 0 && typeof value === "number") {
        const numStr = String(value);
        matches = ocrBlocks.filter(block => {
          const blockText = block.text.replace(/[^\d.-]/g, "");
          return blockText.includes(numStr) || numStr.includes(blockText);
        });
      }

      return matches;
    };

    // Map simple fields
    for (const [key, value] of Object.entries(extractedData)) {
      if (Array.isArray(value)) {
        // Handle arrays (line items)
        // For arrays, we'll create table elements separately
        continue;
      } else if (typeof value === "object" && value !== null) {
        // Handle nested objects
        const nestedObj = value as Record<string, unknown>;
        for (const [nestedKey, nestedValue] of Object.entries(nestedObj)) {
          const fieldPath = `${key}.${nestedKey}`;
          const blocks = findBlocksForValue(nestedValue, fieldPath);
          if (blocks.length > 0) {
            mappings.set(fieldPath, blocks);
          }
        }
      } else {
        // Handle primitive values
        const blocks = findBlocksForValue(value, key);
        if (blocks.length > 0) {
          mappings.set(key, blocks);
        }
      }
    }

    return mappings;
  }

  /**
   * Convert OCR blocks to template elements
   */
  private convertBlocksToElements(
    ocrBlocks: OCRTextBlock[],
    fieldMappings: Map<string, OCRTextBlock[]>,
    extractedData: Record<string, unknown>,
    currency: string
  ): TemplateElement[] {
    const elements: TemplateElement[] = [];
    const CANVAS_WIDTH = 794; // A4 width in pixels
    const CANVAS_HEIGHT = 1123; // A4 height in pixels
    let elementIdCounter = 1;

    // Normalize OCR coordinates to canvas coordinates
    // OCR coordinates are relative to the original image, we need to scale them
    const normalizeCoordinates = (x: number, y: number, width: number, height: number) => {
      // For now, assume OCR coordinates are already in pixels
      // In production, you might need to scale based on image dimensions
      return {
        x: Math.max(0, Math.min(x, CANVAS_WIDTH - 20)),
        y: Math.max(0, Math.min(y, CANVAS_HEIGHT - 20)),
        width: Math.max(20, Math.min(width, CANVAS_WIDTH - x)),
        height: Math.max(20, Math.min(height, CANVAS_HEIGHT - y)),
      };
    };

    // If no field mappings, create elements from all OCR blocks as fallback
    if (fieldMappings.size === 0) {
      logger.warn("No field mappings found, creating elements from all OCR blocks", {
        ocrBlockCount: ocrBlocks.length,
        extractedFieldCount: Object.keys(extractedData).length,
      });

      // Create text elements from top OCR blocks
      const topBlocks = ocrBlocks
        .filter(b => b.boundingBox.width > 0 && b.boundingBox.height > 0)
        .sort((a, b) => a.boundingBox.y - b.boundingBox.y)
        .slice(0, Math.min(20, ocrBlocks.length)); // Take top 20 blocks

      for (const block of topBlocks) {
        const coords = normalizeCoordinates(
          block.boundingBox.x,
          block.boundingBox.y,
          block.boundingBox.width,
          block.boundingBox.height
        );

        elements.push({
          id: `element-${elementIdCounter++}`,
          type: "text",
          x: coords.x,
          y: coords.y,
          width: coords.width,
          height: coords.height,
          rotation: 0,
          zIndex: 1,
          visible: true,
          text: block.text.substring(0, 50), // Limit text length
          binding: undefined, // No binding since we couldn't map it
          typography: {
            fontFamily: "Inter",
            fontSize: 12,
            fontWeight: "normal",
            lineHeight: 1.2,
            letterSpacing: 0,
            color: "#111827",
            align: "left",
            uppercase: false,
            lowercase: false,
          },
          format: { kind: "none" },
          padding: 0,
          opacity: 1,
        });
      }

      return elements;
    }

    // Convert mapped fields to elements
    for (const [fieldPath, blocks] of fieldMappings.entries()) {
      if (blocks.length === 0) continue;

      // Use the first block (or merge multiple blocks if needed)
      const primaryBlock = blocks[0];
      
      // Validate block coordinates
      if (
        primaryBlock.boundingBox.width <= 0 ||
        primaryBlock.boundingBox.height <= 0 ||
        primaryBlock.boundingBox.x < 0 ||
        primaryBlock.boundingBox.y < 0
      ) {
        logger.warn("Skipping block with invalid coordinates", {
          fieldPath,
          boundingBox: primaryBlock.boundingBox,
        });
        continue;
      }

      const coords = normalizeCoordinates(
        primaryBlock.boundingBox.x,
        primaryBlock.boundingBox.y,
        primaryBlock.boundingBox.width,
        primaryBlock.boundingBox.height
      );

      // Validate normalized coordinates
      if (coords.width <= 0 || coords.height <= 0) {
        logger.warn("Skipping block with invalid normalized coordinates", {
          fieldPath,
          coords,
        });
        continue;
      }

      // Determine element type based on field path and value
      const fieldValue = this.getNestedValue(extractedData, fieldPath);
      const elementType = this.determineElementType(fieldPath, fieldValue, currency);

      if (elementType === "currency") {
        elements.push({
          id: `element-${elementIdCounter++}`,
          type: "currency",
          x: coords.x,
          y: coords.y,
          width: coords.width,
          height: coords.height,
          rotation: 0,
          zIndex: 1,
          visible: true,
          binding: fieldPath,
          currency,
          currencyLinks: [],
          mode: "independent",
          placeholder: "",
          align: "left",
        });
      } else if (elementType === "text") {
        // Extract label from block text (e.g., "Invoice #12345" -> label: "Invoice #", value: "12345")
        const label = this.extractLabel(primaryBlock.text, fieldValue);
        
        elements.push({
          id: `element-${elementIdCounter++}`,
          type: "text",
          x: coords.x,
          y: coords.y,
          width: coords.width,
          height: coords.height,
          rotation: 0,
          zIndex: 1,
          visible: true,
          text: label,
          binding: fieldPath,
          typography: {
            fontFamily: "Inter",
            fontSize: 12,
            fontWeight: "normal",
            lineHeight: 1.2,
            letterSpacing: 0,
            color: "#111827",
            align: "left",
            uppercase: false,
            lowercase: false,
          },
          format: { kind: "none" },
          padding: 0,
          opacity: 1,
        });
      }
    }

    // Handle arrays (line items) - create table element
    for (const [key, value] of Object.entries(extractedData)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
        // Find OCR blocks that might be part of the table
        const tableBlocks = this.findTableBlocks(ocrBlocks, value);
        
        if (tableBlocks.length > 0) {
          // Calculate table bounds from blocks
          const tableBounds = this.calculateTableBounds(tableBlocks);
          const coords = normalizeCoordinates(
            tableBounds.x,
            tableBounds.y,
            tableBounds.width,
            tableBounds.height
          );

          // Create columns from first item
          const firstItem = value[0] as Record<string, unknown>;
          const columns = Object.keys(firstItem).map(colKey => {
            const colValue = firstItem[colKey];
            const isNumeric = this.isNumeric(colValue);
            const isCurrency = isNumeric && this.looksLikeCurrency(colKey, colValue);
            
            return {
              id: colKey,
              header: this.formatLabel(colKey),
              width: coords.width / Object.keys(firstItem).length,
              align: (isNumeric ? "right" : "left") as "left" | "center" | "right",
              type: (isCurrency ? "currency" : isNumeric ? "number" : "text") as "text" | "number" | "date" | "currency",
              binding: colKey,
              format: {
                kind: isCurrency ? ("currency" as const) : ("none" as const),
                currency: isCurrency ? currency : undefined,
              },
              showTotal: isCurrency || isNumeric,
            };
          });

          elements.push({
            id: `element-${elementIdCounter++}`,
            type: "table",
            x: coords.x,
            y: coords.y,
            width: coords.width,
            height: coords.height,
            rotation: 0,
            zIndex: 1,
            visible: true,
            itemsBinding: key,
            columns,
            rowHeight: 28,
            headerHeight: 28,
            stripe: true,
            designRows: [],
          });
        }
      }
    }

    return elements;
  }

  /**
   * Determine element type based on field path and value
   */
  private determineElementType(
    fieldPath: string,
    value: unknown,
    currency: string
  ): "text" | "currency" | "input" {
    // Check if it's a currency field
    const currencyKeywords = ["total", "subtotal", "amount", "price", "cost", "fee", "tax", "vat"];
    const fieldPathLower = fieldPath.toLowerCase();
    
    if (currencyKeywords.some(keyword => fieldPathLower.includes(keyword))) {
      return "currency";
    }

    // Check if value is numeric and looks like currency
    if (typeof value === "number" && value > 0 && value < 1000000) {
      return "currency";
    }

    // Check if it's a date field
    if (fieldPathLower.includes("date")) {
      return "input";
    }

    return "text";
  }

  /**
   * Extract label from OCR text (e.g., "Invoice #12345" -> "Invoice #")
   */
  private extractLabel(ocrText: string, fieldValue: unknown): string {
    if (fieldValue === null || fieldValue === undefined) {
      return ocrText;
    }

    const valueStr = String(fieldValue);
    const valueIndex = ocrText.indexOf(valueStr);
    
    if (valueIndex > 0) {
      return ocrText.substring(0, valueIndex).trim();
    }

    return ocrText;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Find OCR blocks that might be part of a table
   */
  private findTableBlocks(ocrBlocks: OCRTextBlock[], items: unknown[]): OCRTextBlock[] {
    // Simple heuristic: find blocks that are aligned in rows
    // In production, you might use more sophisticated table detection
    return ocrBlocks.filter(block => {
      // Check if block text might be part of a table row
      const text = block.text.toLowerCase();
      const tableKeywords = ["item", "description", "qty", "quantity", "price", "total", "amount"];
      return tableKeywords.some(keyword => text.includes(keyword));
    });
  }

  /**
   * Calculate table bounds from OCR blocks
   */
  private calculateTableBounds(blocks: OCRTextBlock[]): { x: number; y: number; width: number; height: number } {
    if (blocks.length === 0) {
      return { x: 0, y: 0, width: 794, height: 200 };
    }

    const xs = blocks.map(b => b.boundingBox.x);
    const ys = blocks.map(b => b.boundingBox.y);
    const widths = blocks.map(b => b.boundingBox.width);
    const heights = blocks.map(b => b.boundingBox.height);

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs.map((x, i) => x + widths[i]));
    const maxY = Math.max(...ys.map((y, i) => y + heights[i]));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Format field name to label
   */
  private formatLabel(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Check if value is numeric
   */
  private isNumeric(value: unknown): boolean {
    return typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)));
  }

  /**
   * Check if field looks like a currency field
   */
  private looksLikeCurrency(fieldName: string, value: unknown): boolean {
    const currencyKeywords = ["price", "amount", "total", "cost", "fee", "tax", "vat", "subtotal"];
    const fieldNameLower = fieldName.toLowerCase();
    return currencyKeywords.some(keyword => fieldNameLower.includes(keyword));
  }
}

// Export singleton instance
let ocrToTemplateServiceInstance: OCRToTemplateService | null = null;

export function getOCRToTemplateService(): OCRToTemplateService {
  if (!ocrToTemplateServiceInstance) {
    ocrToTemplateServiceInstance = new OCRToTemplateService();
  }
  return ocrToTemplateServiceInstance;
}

