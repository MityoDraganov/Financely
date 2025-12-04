import { logger } from "firebase-functions";
import { AIService } from "../ai/ai-service";
import { getAIService } from "../ai/ai-service";
import { TemplateData, TemplateElement } from "../../core/entities/template";
import { Organization } from "../../core/entities/organization";
import { ExtractionJob } from "../../core/entities/invoice-extraction-job";
import { invoiceComplianceService } from "../invoice-compliance-service";
import { COMPLIANCE_SCHEMAS } from "../../core/entities/invoice-compliance";
import { validateTemplateCompliance } from "../../utils/invoice-compliance";
import type { JSONSchema } from "../ai/ai-service";

/**
 * Service for generating invoice templates from extracted invoice data
 * Analyzes the structure of extracted data and creates a matching template
 */
export class TemplateFromExtractionService {
  private aiService: AIService;

  constructor(aiService?: AIService) {
    this.aiService = aiService || getAIService();
  }

  /**
   * Generate an invoice template from extracted invoice data
   * Analyzes the data structure and creates a template with matching bindings
   */
  async generateTemplateFromExtraction(
    extractionJob: ExtractionJob,
    organization: Organization,
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional";
      templateName?: string;
    }
  ): Promise<TemplateData> {
    if (!extractionJob.extractedData || Object.keys(extractionJob.extractedData).length === 0) {
      throw new Error("Extraction job has no extracted data to generate template from");
    }

    // Detect compliance region
    const region = invoiceComplianceService.detectRegion(organization);
    const complianceSchema = COMPLIANCE_SCHEMAS[region];

    // Analyze the extracted data structure
    const dataStructure = this.analyzeDataStructure(extractionJob.extractedData);
    
    // Build context for AI
    const context = this.buildExtractionContext(
      extractionJob,
      organization,
      dataStructure,
      region
    );

    // Build prompt for template generation
    const prompt = this.buildTemplateFromExtractionPrompt(
      context,
      dataStructure,
      region,
      organization,
      options
    );

    // Define schema for template generation
    // Note: JSONSchema doesn't support enum, so we'll validate in the prompt
    const schema: JSONSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        pageSize: { type: "string" },
        brand: {
          type: "object",
          properties: {
            fonts: { type: "array", items: { type: "string" } },
            colors: {
              type: "object",
              properties: {
                primary: { type: "string" },
                secondary: { type: "string" },
                accent: { type: "string" },
              },
            },
            margins: {
              type: "object",
              properties: {
                top: { type: "number" },
                right: { type: "number" },
                bottom: { type: "number" },
                left: { type: "number" },
              },
            },
          },
        },
        elements: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              binding: { type: "string" },
              text: { type: "string" },
              typography: { type: "object" },
              format: { type: "object" },
              itemsBinding: { type: "string" },
              columns: { type: "array" },
              currency: { type: "string" },
              mode: { type: "string" },
              formula: { type: "string" },
              calc: { type: "string" },
            },
          },
        },
      },
    };

    try {
      const result = await this.aiService.generateJSON<{
        name: string;
        description?: string;
        pageSize: "A4" | "Letter";
        brand: {
          fonts: string[];
          colors: { primary: string; secondary: string; accent: string };
          margins: { top: number; right: number; bottom: number; left: number };
        };
        elements: Array<{
          id: string;
          type: "text" | "image" | "table" | "box" | "line" | "input" | "currency";
          x: number;
          y: number;
          width: number;
          height: number;
          binding?: string;
          text?: string;
          typography?: any;
          format?: any;
          itemsBinding?: string;
          columns?: any[];
          currency?: string;
          mode?: string;
          formula?: string;
          calc?: string;
        }>;
      }>(prompt, schema, {
        temperature: 0.7,
        maxTokens: 16384,
      });

      // Determine currency
      const regionCurrencyMap: Record<"US" | "EU" | "CA" | "AU" | "UK", string> = {
        US: "USD",
        EU: "EUR",
        CA: "CAD",
        AU: "AUD",
        UK: "GBP",
      };
      const currency = organization.settings?.defaultCurrency || regionCurrencyMap[region] || "USD";

      // Build template data
      const template: TemplateData = {
        orgId: organization.id,
        name: options?.templateName || result.name || `Template from ${extractionJob.fileName}`,
        description: result.description || `Template generated from extracted invoice: ${extractionJob.fileName}`,
        pageSize: result.pageSize || "A4",
        brand: {
          fonts: result.brand?.fonts || ["Inter"],
          colors: result.brand?.colors || {
            primary: organization.settings?.brandColors?.primary || "#111827",
            secondary: organization.settings?.brandColors?.secondary || "#6b7280",
            accent: organization.settings?.brandColors?.accent || "#2563eb",
          },
          margins: result.brand?.margins || { top: 40, right: 40, bottom: 40, left: 40 },
        },
        elements: this.enrichElements(result.elements, dataStructure, region, currency),
        status: "draft",
        compliance: {
          region,
          requiredFields: complianceSchema.requiredFields.map(f => f.binding),
          autoFooter: true,
          complianceValidated: false,
        },
      };

      // Validate template compliance
      const missingBindings = validateTemplateCompliance(template.elements, region);
      if (missingBindings.length > 0) {
        logger.warn("Generated template has compliance issues", {
          missingBindings,
          extractionJobId: extractionJob.id,
        });
      }

      logger.info("Template generated from extraction successfully", {
        extractionJobId: extractionJob.id,
        organizationId: organization.id,
        elementCount: template.elements.length,
        dataFieldCount: Object.keys(extractionJob.extractedData || {}).length,
      });

      return template;
    } catch (error) {
      logger.error("Failed to generate template from extraction", {
        error: error instanceof Error ? error.message : "Unknown error",
        extractionJobId: extractionJob.id,
        organizationId: organization.id,
      });
      throw new Error(
        `Failed to generate template from extraction: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Analyze the structure of extracted invoice data
   * Identifies field types, nested objects, arrays, etc.
   */
  private analyzeDataStructure(data: Record<string, unknown>): {
    fields: Array<{ path: string; type: string; label: string; isArray: boolean; isNested: boolean }>;
    arrays: Array<{ path: string; label: string; itemStructure: Record<string, string> }>;
    nestedObjects: Array<{ path: string; label: string; fields: string[] }>;
  } {
    const fields: Array<{ path: string; type: string; label: string; isArray: boolean; isNested: boolean }> = [];
    const arrays: Array<{ path: string; label: string; itemStructure: Record<string, string> }> = [];
    const nestedObjects: Array<{ path: string; label: string; fields: string[] }> = [];

    const analyzeValue = (
      value: unknown,
      path: string,
      label: string
    ): void => {
      if (value === null || value === undefined) {
        return;
      }

      if (Array.isArray(value)) {
        // It's an array
        if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
          // Array of objects - analyze first item structure
          const itemStructure: Record<string, string> = {};
          const firstItem = value[0] as Record<string, unknown>;
          
          for (const [key, itemValue] of Object.entries(firstItem)) {
            itemStructure[key] = this.getTypeName(itemValue);
          }

          arrays.push({
            path,
            label: this.formatLabel(path),
            itemStructure,
          });
        } else {
          // Array of primitives
          fields.push({
            path,
            type: "array",
            label: this.formatLabel(path),
            isArray: true,
            isNested: false,
          });
        }
      } else if (typeof value === "object") {
        // It's a nested object
        const obj = value as Record<string, unknown>;
        const nestedFields: string[] = [];

        for (const [key, nestedValue] of Object.entries(obj)) {
          const nestedPath = path ? `${path}.${key}` : key;
          nestedFields.push(nestedPath);
          analyzeValue(nestedValue, nestedPath, key);
        }

        nestedObjects.push({
          path,
          label: this.formatLabel(path),
          fields: nestedFields,
        });
      } else {
        // It's a primitive value
        fields.push({
          path,
          type: this.getTypeName(value),
          label: this.formatLabel(path),
          isArray: false,
          isNested: false,
        });
      }
    };

    // Analyze top-level fields
    for (const [key, value] of Object.entries(data)) {
      analyzeValue(value, key, key);
    }

    return { fields, arrays, nestedObjects };
  }

  /**
   * Get type name for a value
   */
  private getTypeName(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (Array.isArray(value)) return "array";
    if (typeof value === "number") {
      // Check if it looks like a monetary value
      if (value > 0 && value < 1000000) {
        return "currency";
      }
      return "number";
    }
    if (typeof value === "string") {
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}/.test(value) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) {
        return "date";
      }
      return "string";
    }
    if (typeof value === "boolean") return "boolean";
    return typeof value;
  }

  /**
   * Format a field path into a readable label
   */
  private formatLabel(path: string): string {
    return path
      .split(".")
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  /**
   * Build context string from extraction job and organization
   */
  private buildExtractionContext(
    extractionJob: ExtractionJob,
    organization: Organization,
    dataStructure: ReturnType<typeof this.analyzeDataStructure>,
    region: "US" | "EU" | "CA" | "AU" | "UK"
  ): string {
    const contextParts: string[] = [];

    // Organization context
    contextParts.push(`Organization: ${organization.name}`);
    if (organization.settings?.address) {
      contextParts.push(`Organization Address: ${organization.settings.address}`);
    }
    if (organization.settings?.email) {
      contextParts.push(`Organization Email: ${organization.settings.email}`);
    }
    if (organization.settings?.phone) {
      contextParts.push(`Organization Phone: ${organization.settings.phone}`);
    }
    if (organization.settings?.defaultCurrency) {
      contextParts.push(`Default Currency: ${organization.settings.defaultCurrency}`);
    }

    // Extraction job context
    contextParts.push(`\nSource Invoice: ${extractionJob.fileName}`);
    if (extractionJob.vendorName) {
      contextParts.push(`Vendor: ${extractionJob.vendorName}`);
    }
    if (extractionJob.documentType) {
      contextParts.push(`Document Type: ${extractionJob.documentType}`);
    }

    // Data structure context
    contextParts.push(`\nExtracted Data Structure:`);
    contextParts.push(`- Total fields: ${dataStructure.fields.length}`);
    contextParts.push(`- Arrays: ${dataStructure.arrays.length}`);
    contextParts.push(`- Nested objects: ${dataStructure.nestedObjects.length}`);

    // Field details
    contextParts.push(`\nFields found:`);
    for (const field of dataStructure.fields) {
      contextParts.push(`  - ${field.path} (${field.type})`);
    }

    // Array details
    if (dataStructure.arrays.length > 0) {
      contextParts.push(`\nArrays found:`);
      for (const arr of dataStructure.arrays) {
        contextParts.push(`  - ${arr.path} (array of objects)`);
        for (const [key, type] of Object.entries(arr.itemStructure)) {
          contextParts.push(`    - ${key}: ${type}`);
        }
      }
    }

    // Nested object details
    if (dataStructure.nestedObjects.length > 0) {
      contextParts.push(`\nNested objects found:`);
      for (const obj of dataStructure.nestedObjects) {
        contextParts.push(`  - ${obj.path}:`);
        for (const field of obj.fields) {
          contextParts.push(`    - ${field}`);
        }
      }
    }

    // Extracted data sample (first 2000 chars)
    const dataSample = JSON.stringify(extractionJob.extractedData, null, 2).substring(0, 2000);
    contextParts.push(`\nExtracted Data Sample:\n${dataSample}`);

    return contextParts.join("\n");
  }

  /**
   * Build prompt for generating template from extraction
   */
  private buildTemplateFromExtractionPrompt(
    context: string,
    dataStructure: ReturnType<typeof this.analyzeDataStructure>,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    organization: Organization,
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional";
      templateName?: string;
    }
  ): string {
    const style = options?.style || "modern";
    const styleDescription = this.getStyleDescription(style);

    // Get compliance requirements
    const complianceSchema = COMPLIANCE_SCHEMAS[region];
    const requiredFields = complianceSchema.requiredFields.map(f => ({
      binding: f.binding,
      label: f.label,
      description: f.description,
      format: f.format,
    }));

    // Determine currency
    const regionCurrencyMap: Record<"US" | "EU" | "CA" | "AU" | "UK", string> = {
      US: "USD",
      EU: "EUR",
      CA: "CAD",
      AU: "AUD",
      UK: "GBP",
    };
    const currency = organization.settings?.defaultCurrency || regionCurrencyMap[region] || "USD";

    return `You are an expert invoice template designer. Generate a professional invoice template that matches the structure of the extracted invoice data.

CONTEXT:
${context}

TEMPLATE REQUIREMENTS:

1. **Match Extracted Data Structure**: 
   - Create template elements with bindings that EXACTLY match the field paths in the extracted data
   - For nested objects (e.g., seller.name, buyer.address), use dot notation in bindings
   - For arrays (e.g., items), create a table element with itemsBinding="items" (or the actual array field name)
   - Ensure ALL fields from extracted data have corresponding template elements

2. **Field Type Mapping**:
   - String fields → Text elements (with binding)
   - Number fields that look like currency → Currency elements (with binding and currency code)
   - Date fields → Input elements with variant="date" or Text elements with date formatting
   - Array fields → Table elements (with itemsBinding and columns matching array item structure)
   - Nested objects → Text elements with dot-notation bindings (e.g., "seller.name")

3. **Table Elements for Arrays**:
   - For each array field found, create a table element
   - Set itemsBinding to the array field name (e.g., "items", "lineItems", "products")
   - Create columns for each property in the array items
   - For price/amount columns, use type="currency" with the currency code
   - For calculated columns (like lineTotal = quantity * unitPrice), add calc property

4. **Currency Elements**:
   - Use Currency elements for ALL monetary values (total, subtotal, vatTotal, taxTotal, etc.)
   - Set currency code (e.g., "${currency}")
   - For calculated totals, use mode: "formula" with appropriate formulas
   - Example formula for total: =IF(subtotal > 0, subtotal, IF(netAmount > 0, netAmount, 0)) + IF(vatTotal > 0, vatTotal, IF(taxTotal > 0, taxTotal, 0))

5. **Layout Guidelines**:
   - Style: ${styleDescription}
   - Canvas dimensions: 794x1123 pixels (A4)
   - All elements MUST satisfy: x >= 0, y >= 0, x + width <= 794, y + height <= 1123
   - Use consistent margins: 40-60px from edges
   - Header section: Logo/org info (left), invoice details (right)
   - Seller/Buyer sections: Side by side or stacked
   - Items table: Full width with proper column widths
   - Totals section: Right-aligned, below items table

6. **Compliance Requirements** (${region} region):
   ${requiredFields.map(f => `   - ${f.binding}: ${f.label} (${f.description || ""})`).join("\n   ")}

7. **Binding Requirements**:
   - Use EXACT field paths from extracted data as bindings
   - For nested fields, use dot notation (e.g., "seller.name", "buyer.address")
   - For table items, use the array field name as itemsBinding
   - Table column bindings should match the property names in array items

CRITICAL CANVAS BOUNDARIES:
- Canvas: 794px width × 1123px height
- EVERY element MUST satisfy: x + width <= 794 AND y + height <= 1123
- Validate each element position before including it

Generate a complete template JSON with:
- name: "${options?.templateName || "Template from Extracted Invoice"}"
- description: Brief description mentioning it was generated from extracted data
- pageSize: "A4"
- brand: Use organization colors if available, otherwise professional defaults
- elements: Array of all template elements with proper bindings matching extracted data structure

Ensure the template can display ALL fields from the extracted data.`;
  }

  /**
   * Get style description
   */
  private getStyleDescription(style: "modern" | "classic" | "minimal" | "professional"): string {
    const descriptions: Record<string, string> = {
      modern: "Clean, contemporary design with ample whitespace and modern typography",
      classic: "Traditional business invoice style with clear sections and borders",
      minimal: "Minimalist design with focus on content and simplicity",
      professional: "Corporate-style invoice with structured layout and formal appearance",
    };
    return descriptions[style] || descriptions.modern;
  }

  /**
   * Enrich generated elements with proper defaults
   */
  private enrichElements(
    elements: Array<{
      id: string;
      type: "text" | "image" | "table" | "box" | "line" | "input" | "currency";
      x: number;
      y: number;
      width: number;
      height: number;
      binding?: string;
      text?: string;
      typography?: any;
      format?: any;
      itemsBinding?: string;
      columns?: any[];
      currency?: string;
      mode?: string;
      formula?: string;
      calc?: string;
    }>,
    dataStructure: ReturnType<typeof this.analyzeDataStructure>,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    currency: string
  ): TemplateElement[] {
    const CANVAS_WIDTH = 794;
    const CANVAS_HEIGHT = 1123;
    const enriched: TemplateElement[] = [];

    for (const el of elements) {
      // Clamp to canvas
      el.x = Math.max(0, Math.min(el.x, CANVAS_WIDTH - 20));
      el.y = Math.max(0, Math.min(el.y, CANVAS_HEIGHT - 20));
      const maxWidth = CANVAS_WIDTH - el.x;
      el.width = Math.max(20, Math.min(el.width, maxWidth));
      const maxHeight = CANVAS_HEIGHT - el.y;
      el.height = Math.max(20, Math.min(el.height, maxHeight));

      // Normalize element based on type
      const normalized = this.normalizeElement(el, region, currency);
      if (normalized) {
        enriched.push(normalized);
      }
    }

    return enriched;
  }

  /**
   * Normalize an element to proper TemplateElement format
   */
  private normalizeElement(
    el: {
      id: string;
      type: "text" | "image" | "table" | "box" | "line" | "input" | "currency";
      x: number;
      y: number;
      width: number;
      height: number;
      binding?: string;
      text?: string;
      typography?: any;
      format?: any;
      itemsBinding?: string;
      columns?: any[];
      currency?: string;
      mode?: string;
      formula?: string;
      calc?: string;
    },
    region: "US" | "EU" | "CA" | "AU" | "UK",
    currency: string
  ): TemplateElement | null {
    const base = {
      id: el.id,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: 0,
      zIndex: 1,
      visible: true,
    };

    switch (el.type) {
      case "text":
        return {
          ...base,
          type: "text",
          text: el.text || "",
          binding: el.binding,
          typography: el.typography || {
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
          format: el.format || { kind: "none" },
          padding: 0,
          opacity: 1,
        };

      case "currency":
        return {
          ...base,
          type: "currency",
          binding: el.binding,
          currency: el.currency || currency,
          currencyLinks: [],
          mode: (el.mode as "independent" | "linked" | "formula") || "independent",
          formula: el.formula,
          placeholder: "",
          align: "left",
        };

      case "table":
        return {
          ...base,
          type: "table",
          itemsBinding: el.itemsBinding || "items",
          columns: el.columns || [],
          rowHeight: 28,
          headerHeight: 28,
          stripe: true,
          designRows: [],
        };

      case "input":
        return {
          ...base,
          type: "input",
          binding: el.binding,
          placeholder: "",
          variant: "text",
          align: "left",
        };

      case "box":
        return {
          ...base,
          type: "box",
          fill: "#ffffff00",
          stroke: "#e5e7eb",
          strokeWidth: 1,
          radius: 0,
          opacity: 1,
        };

      case "line":
        return {
          ...base,
          type: "line",
          x2: el.x + el.width,
          y2: el.y,
          stroke: "#e5e7eb",
          strokeWidth: 1,
        };

      default:
        return null;
    }
  }
}

// Export singleton instance
let templateFromExtractionServiceInstance: TemplateFromExtractionService | null = null;

/**
 * Get or create the template from extraction service instance
 */
export function getTemplateFromExtractionService(): TemplateFromExtractionService {
  if (!templateFromExtractionServiceInstance) {
    templateFromExtractionServiceInstance = new TemplateFromExtractionService();
  }
  return templateFromExtractionServiceInstance;
}

