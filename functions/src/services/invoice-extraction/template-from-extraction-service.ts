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
import { getOCRToTemplateService } from "./ocr-to-template-service";

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
   * 
   * Uses optimized OCR-to-template conversion when OCR layout data is available,
   * otherwise falls back to AI generation.
   * 
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

    // Try to recover OCR blocks from ocrRawResults if ocrTextBlocks is not available
    // This handles cases where jobs were extracted before ocrTextBlocks field was added
    let ocrTextBlocks = extractionJob.ocrTextBlocks;
    
    if ((!ocrTextBlocks || ocrTextBlocks.length === 0) && extractionJob.ocrRawResults) {
      // Try to extract textBlocks from ocrRawResults
      const rawResults = extractionJob.ocrRawResults as any;
      
      logger.info("Attempting to recover OCR blocks from ocrRawResults", {
        extractionJobId: extractionJob.id,
        hasRawResults: !!rawResults,
        rawResultsKeys: rawResults ? Object.keys(rawResults) : [],
        hasTextBlocks: !!(rawResults?.textBlocks),
        textBlocksType: typeof rawResults?.textBlocks,
        textBlocksIsArray: Array.isArray(rawResults?.textBlocks),
        textBlocksLength: rawResults?.textBlocks?.length || 0,
      });
      
      if (rawResults?.textBlocks && Array.isArray(rawResults.textBlocks) && rawResults.textBlocks.length > 0) {
        logger.info("Recovering OCR text blocks from ocrRawResults", {
          extractionJobId: extractionJob.id,
          recoveredBlockCount: rawResults.textBlocks.length,
        });
        ocrTextBlocks = rawResults.textBlocks;
      } else {
        logger.warn("Could not recover OCR blocks from ocrRawResults", {
          extractionJobId: extractionJob.id,
          rawResultsStructure: rawResults ? JSON.stringify(Object.keys(rawResults)).substring(0, 200) : "null",
        });
      }
    }

    logger.info("Checking OCR text blocks availability", {
      extractionJobId: extractionJob.id,
      hasOcrTextBlocks: !!ocrTextBlocks,
      ocrTextBlocksType: typeof ocrTextBlocks,
      ocrTextBlocksIsArray: Array.isArray(ocrTextBlocks),
      ocrBlockCount: ocrTextBlocks ? ocrTextBlocks.length : 0,
      extractedFieldCount: Object.keys(extractionJob.extractedData || {}).length,
      hasOcrRawResults: !!extractionJob.ocrRawResults,
    });

    if (ocrTextBlocks && ocrTextBlocks.length > 0) {
      // Temporarily set ocrTextBlocks on extractionJob for the OCR service
      const jobWithOcrBlocks = { ...extractionJob, ocrTextBlocks };
      logger.info("Using OCR-to-template conversion (optimized path)", {
        extractionJobId: extractionJob.id,
        ocrBlockCount: ocrTextBlocks.length,
        extractedFieldCount: Object.keys(extractionJob.extractedData || {}).length,
      });

      try {
        const ocrToTemplateService = getOCRToTemplateService();
        const template = ocrToTemplateService.convertOCRToTemplate(jobWithOcrBlocks, organization, options);
        
        // Validate that template has elements
        if (template.elements && template.elements.length > 0) {
          logger.info("OCR-to-template conversion succeeded", {
            extractionJobId: extractionJob.id,
            elementCount: template.elements.length,
          });
          return template;
        } else {
          logger.warn("OCR-to-template conversion produced template with no elements, falling back to AI", {
            extractionJobId: extractionJob.id,
          });
          // Fall through to AI generation
        }
      } catch (error) {
        logger.warn("OCR-to-template conversion failed, falling back to AI generation", {
          extractionJobId: extractionJob.id,
          error: error instanceof Error ? error.message : "Unknown error",
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        // Fall through to AI generation
      }
    }

    // FALLBACK PATH: AI generation (slower, but works when OCR layout is not available)
    logger.info("Using AI template generation (fallback path)", {
      extractionJobId: extractionJob.id,
    });

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
      required: ["name", "pageSize", "brand", "elements"], // Make elements required
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        pageSize: { type: "string" },
        brand: {
          type: "object",
          required: ["fonts", "colors", "margins"],
          properties: {
            fonts: { type: "array", items: { type: "string" } },
            colors: {
              type: "object",
              required: ["primary", "secondary", "accent"],
              properties: {
                primary: { type: "string" },
                secondary: { type: "string" },
                accent: { type: "string" },
              },
            },
            margins: {
              type: "object",
              required: ["top", "right", "bottom", "left"],
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
            required: ["id", "type", "x", "y", "width", "height"],
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

      // Log AI response for debugging
      logger.info("AI generated template response", {
        extractionJobId: extractionJob.id,
        hasElements: !!result.elements,
        elementCount: result.elements?.length || 0,
        hasName: !!result.name,
        hasBrand: !!result.brand,
        dataFieldCount: Object.keys(extractionJob.extractedData || {}).length,
      });

      // Validate that elements were generated
      if (!result.elements || result.elements.length === 0) {
        logger.error("AI generated template with no elements - this should not happen", {
          extractionJobId: extractionJob.id,
          resultKeys: Object.keys(result),
          resultPreview: JSON.stringify(result).substring(0, 1000),
          dataStructureFields: dataStructure.fields.length,
          dataStructureArrays: dataStructure.arrays.length,
        });
        
        // Throw error to prevent creating template without elements
        throw new Error("AI failed to generate template elements. The response did not include any elements.");
      }

      // Determine currency
      const regionCurrencyMap: Record<"US" | "EU" | "CA" | "AU" | "UK", string> = {
        US: "USD",
        EU: "EUR",
        CA: "CAD",
        AU: "AUD",
        UK: "GBP",
      };
      const currency = organization.settings?.defaultCurrency || regionCurrencyMap[region] || "USD";

      // Enrich elements
      const enrichedElements = this.enrichElements(result.elements, dataStructure, region, currency);
      
      // Validate enriched elements
      if (enrichedElements.length === 0) {
        logger.error("All elements were filtered out during enrichment", {
          extractionJobId: extractionJob.id,
          rawElementCount: result.elements.length,
          dataStructureFields: dataStructure.fields.length,
          rawElements: result.elements.map(el => ({
            id: el.id,
            type: el.type,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
          })),
        });
        throw new Error("All template elements were invalid and filtered out. Cannot create template without elements.");
      }

      // Generate productTableConfig based on the table elements
      // Product entity fields: name, description, price, currency, sku, barcode, category, taxRate, cost
      let productTableConfig: TemplateData["productTableConfig"] = undefined;
      const itemsTable = enrichedElements.find(
        (el): el is Extract<typeof el, { type: "table" }> =>
          el.type === "table" && !!(el as Extract<typeof el, { type: "table" }>).itemsBinding
      );
      
      if (itemsTable && itemsTable.itemsBinding && itemsTable.columns && itemsTable.columns.length > 0) {
        const columnMappings: Array<{
          columnBinding: string;
          productField: "name" | "description" | "price" | "currency" | "sku" | "barcode" | "category" | "taxRate" | "cost";
          transform: "none" | "currency_convert" | "format_number";
          targetCurrency?: string;
          lockOnProductSelect: boolean;
        }> = [];
        
        for (const col of itemsTable.columns) {
          if (!col.binding) continue;
          
          const bindingLower = col.binding.toLowerCase();
          let productField: "name" | "description" | "price" | "currency" | "sku" | "barcode" | "category" | "taxRate" | "cost" | null = null;
          let transform: "none" | "currency_convert" | "format_number" = "none";
          let targetCurrency: string | undefined = undefined;
          
          // Map common column bindings to product fields
          if (bindingLower.includes("description") || bindingLower.includes("name") || bindingLower === "itemdescription") {
            productField = "description";
          } else if (bindingLower.includes("price") || bindingLower.includes("amount") || bindingLower === "unitprice") {
            productField = "price";
            transform = col.type === "currency" ? "currency_convert" : "format_number";
            if (col.type === "currency" && "currency" in col && col.currency) {
              targetCurrency = col.currency;
            }
          } else if (bindingLower === "currency" && col.type === "text") {
            productField = "currency";
          } else if (bindingLower.includes("sku") || bindingLower.includes("reference") || bindingLower === "itemnumber") {
            productField = "sku";
          } else if (bindingLower.includes("category")) {
            productField = "category";
          } else if (bindingLower.includes("tax") && bindingLower.includes("rate")) {
            productField = "taxRate";
          } else if (bindingLower.includes("cost")) {
            productField = "cost";
          }
          
          if (productField) {
            columnMappings.push({
              columnBinding: col.binding,
              productField,
              transform,
              targetCurrency,
              lockOnProductSelect: true,
            });
          }
        }
        
        if (columnMappings.length > 0) {
          productTableConfig = {
            itemsBinding: itemsTable.itemsBinding,
            columnMappings,
            autoQuantity: false,
            defaultQuantity: 1,
            autoConvertCurrency: true,
            defaultCurrency: currency,
          };
        }
      }

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
        elements: enrichedElements,
        status: "draft",
        compliance: {
          region,
          requiredFields: complianceSchema.requiredFields.map(f => f.binding),
          autoFooter: true,
          complianceValidated: false,
        },
        ...(productTableConfig && { productTableConfig }),
      };

      // Validate template compliance
      const missingBindings = validateTemplateCompliance(template.elements, region);
      if (missingBindings.length > 0) {
        logger.warn("Generated template has compliance issues", {
          missingBindings,
          extractionJobId: extractionJob.id,
        });
      }

      // Log final template info (this is the main log, others are for debugging)
      logger.info("Template generated from extraction successfully", {
        extractionJobId: extractionJob.id,
        organizationId: organization.id,
        elementCount: template.elements.length,
        dataFieldCount: Object.keys(extractionJob.extractedData || {}).length,
        rawElementCount: result.elements?.length || 0,
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

🚨 CRITICAL RULE - READ THIS FIRST:
**ALL fields with bindings (data fields from extracted data) MUST be Input elements, NOT Text elements.**
- Input elements = editable fields that users fill in (invoiceNumber, invoiceDate, seller.name, etc.)
- Text elements = static labels only (like "Invoice Number:", "Date:" labels) - these have NO bindings
- If a field has a binding, it MUST be an Input element (or Currency element for money)

CONTEXT:
${context}

TEMPLATE REQUIREMENTS:

1. **Match Extracted Data Structure**: 
   - Create template elements with bindings that EXACTLY match the field paths in the extracted data
   - For nested objects (e.g., seller.name, buyer.address), use dot notation in bindings
   - For arrays (e.g., items), create a table element with itemsBinding="items" (or the actual array field name)
   - Ensure ALL fields from extracted data have corresponding template elements

2. **Field Type Mapping**:
   - **IMPORTANT**: Fields with bindings (data fields that users can edit) should be Input elements, NOT Text elements
   - String fields with bindings → Input elements (with binding, variant="text")
   - Number fields that look like currency → Currency elements (with binding and currency code)
   - Date fields → Input elements (with binding, variant="date")
   - Array fields → Table elements (with itemsBinding and columns matching array item structure)
   - Nested object fields with bindings → Input elements (with dot-notation bindings like "seller.name")
   - Static labels/text (no binding) → Text elements (for labels like "Invoice Number:", "Total:", etc.)

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

CRITICAL: You MUST generate a complete template with elements. The elements array is REQUIRED and must contain at least one element.

CRITICAL ELEMENT TYPE RULES:
- **ALL fields with bindings (data fields) MUST be Input elements**, NOT Text elements
- Input elements are for editable data fields (invoiceNumber, invoiceDate, seller.name, customer.address, etc.)
- Text elements are ONLY for static labels (like "Invoice Number:", "Date:", "Total:" labels) that don't have bindings
- Currency fields → Currency elements (with binding)
- Date fields → Input elements (with binding, variant="date")
- String/number fields → Input elements (with binding, variant="text" or variant="number")

Generate a complete template JSON with:
- name: "${options?.templateName || "Template from Extracted Invoice"}"
- description: Brief description mentioning it was generated from extracted data
- pageSize: "A4"
- brand: Use organization colors if available, otherwise professional defaults
- elements: **REQUIRED** - Array of template elements with proper bindings matching extracted data structure. MUST include:
  * Header section: Static labels (Text elements without bindings) + data fields (Input elements with bindings)
  * Seller/Buyer sections: Static labels (Text) + data fields (Input elements with bindings like "seller.name", "buyer.address")
  * Items table element (with itemsBinding matching the array field name from extracted data)
  * Totals section: Static labels (Text) + currency elements (Currency elements with bindings)
  * Footer elements: Static labels (Text) + data fields (Input elements with bindings)

IMPORTANT: 
- The elements array MUST NOT be empty
- Create elements for ALL major fields in the extracted data
- **ALL data fields (fields with bindings) MUST be Input elements**, not Text elements
- Text elements are ONLY for static labels that don't change (no bindings)
- Each element must have valid x, y, width, height within canvas bounds (794x1123)
- Use proper bindings that match the extracted data field paths exactly

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
    let filteredCount = 0;

    for (const el of elements) {
      // Normalize element type to lowercase (AI might return "Text" instead of "text")
      const normalizedType = el.type.toLowerCase() as typeof el.type;
      el.type = normalizedType;

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
      } else {
        filteredCount++;
        logger.warn("Element filtered out during normalization", {
          elementId: el.id,
          elementType: el.type,
          originalType: elements.find(e => e.id === el.id)?.type,
          elementX: el.x,
          elementY: el.y,
        });
      }
    }

    if (filteredCount > 0) {
      logger.warn("Some elements were filtered out during enrichment", {
        totalElements: elements.length,
        enrichedCount: enriched.length,
        filteredCount,
      });
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
    // Normalize type to lowercase (AI might return "Text" instead of "text")
    const elementType = el.type.toLowerCase() as typeof el.type;
    
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

    switch (elementType) {
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

      case "image":
        // Image elements are supported but not fully implemented in normalizeElement
        // For now, convert to a box placeholder
        logger.warn("Image element type not fully supported, converting to box", {
          elementId: el.id,
        });
        return {
          ...base,
          type: "box",
          fill: "#ffffff00",
          stroke: "#e5e7eb",
          strokeWidth: 1,
          radius: 0,
          opacity: 1,
        };

      default:
        logger.warn("Unknown element type, filtering out", {
          elementId: el.id,
          elementType: el.type,
        });
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

