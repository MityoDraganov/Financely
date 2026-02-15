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
import { validateTemplateData, repairTemplateGenerationRaw } from "../ai/template-generation-validate-repair";
import {
  BLOCK_SCHEMA_VERSION,
  buildTemplateLlmManifest,
  buildTemplateGenerationSchema,
  buildTemplateSchemaGuidance,
} from "../../core/block-registry";
import { getOCRToTemplateService } from "./ocr-to-template-service";

type TemplateGenerationStrategy =
  | "layout_fusion_v2"
  | "legacy"
  | "auto"
  | "ocr"
  | "ai";

type TemplateFromExtractionOptions = {
  style?: "modern" | "classic" | "minimal" | "professional";
  templateName?: string;
  strategy?: TemplateGenerationStrategy;
  qualityTarget?: "pixel";
};

type RawTemplateElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
};

type RawTemplateGenerationResult = {
  name?: string;
  description?: string;
  pageSize?: "A4" | "Letter" | "Legal";
  layoutModel?: "primitive_v1" | "hybrid_v2";
  brand?: {
    fonts?: string[];
    colors?: { primary?: string; secondary?: string; accent?: string };
    margins?: { top?: number; right?: number; bottom?: number; left?: number };
    backgroundImage?: string;
    watermark?: Record<string, unknown>;
  };
  pageSettings?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  repeating?: Record<string, unknown>;
  referenceLayer?: Record<string, unknown>;
  blocksV2?: Array<Record<string, unknown>>;
  elements: RawTemplateElement[];
};

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
    options?: TemplateFromExtractionOptions
  ): Promise<TemplateData> {
    if (!extractionJob.extractedData || Object.keys(extractionJob.extractedData).length === 0) {
      throw new Error("Extraction job has no extracted data to generate template from");
    }

    const envPipeline = process.env.INVOICE_TEMPLATE_PIPELINE === "legacy"
      ? "legacy"
      : "layout_fusion_v2";
    const requestedStrategy = options?.strategy;

    const useFusionPipeline =
      requestedStrategy === "layout_fusion_v2" ||
      (!requestedStrategy && envPipeline === "layout_fusion_v2");

    if (useFusionPipeline) {
      logger.info("Using layout_fusion_v2 template compiler", {
        extractionJobId: extractionJob.id,
        envPipeline,
        requestedStrategy: requestedStrategy || null,
      });

      try {
        const ocrToTemplateService = getOCRToTemplateService();
        const compiledTemplate = ocrToTemplateService.convertOCRToTemplate(
          extractionJob,
          organization,
          options
        );

        if (!compiledTemplate.elements || compiledTemplate.elements.length === 0) {
          throw new Error("layout_fusion_v2 compiler produced zero elements.");
        }

        return compiledTemplate;
      } catch (error) {
        logger.error("layout_fusion_v2 template compiler failed", {
          extractionJobId: extractionJob.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        throw new Error(
          `layout_fusion_v2 template generation failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }. To rollback, set INVOICE_TEMPLATE_PIPELINE=legacy.`
        );
      }
    }

    const strategy = requestedStrategy ?? "legacy";

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
      strategy,
      hasOcrTextBlocks: !!ocrTextBlocks,
      ocrTextBlocksType: typeof ocrTextBlocks,
      ocrTextBlocksIsArray: Array.isArray(ocrTextBlocks),
      ocrBlockCount: ocrTextBlocks ? ocrTextBlocks.length : 0,
      extractedFieldCount: Object.keys(extractionJob.extractedData || {}).length,
      hasOcrRawResults: !!extractionJob.ocrRawResults,
    });

    if (strategy !== "ai" && ocrTextBlocks && ocrTextBlocks.length > 0) {
      // Temporarily set ocrTextBlocks on extractionJob for the OCR service
      const jobWithOcrBlocks = { ...extractionJob, ocrTextBlocks };
      logger.info("Using OCR-to-template conversion (optimized path)", {
        extractionJobId: extractionJob.id,
        strategy,
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
            strategy,
          });
          if (strategy === "ocr") {
            throw new Error("OCR strategy was explicitly requested, but OCR conversion produced no elements.");
          }
          // Fall through to AI generation
        }
      } catch (error) {
        if (strategy === "ocr") {
          throw error;
        }
        logger.warn("OCR-to-template conversion failed, falling back to AI generation", {
          extractionJobId: extractionJob.id,
          strategy,
          error: error instanceof Error ? error.message : "Unknown error",
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        // Fall through to AI generation
      }
    }

    // FALLBACK PATH: AI generation (slower, but works when OCR layout is not available)
    logger.info("Using AI template generation (fallback path)", {
      extractionJobId: extractionJob.id,
      strategy,
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

    const schema = buildTemplateGenerationSchema() as unknown as JSONSchema;

    try {
      const result = await this.aiService.generateJSON<RawTemplateGenerationResult>(prompt, schema, {
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

      let template = this.buildTemplateFromRawResult(
        result,
        extractionJob,
        organization,
        dataStructure,
        region,
        currency,
        complianceSchema,
        options
      );

      const parsed = validateTemplateData(template);
      if (!parsed.success) {
        logger.warn("Template validation failed, attempting one-shot repair", {
          extractionJobId: extractionJob.id,
        });
        const repairedRaw = await repairTemplateGenerationRaw(
          this.aiService,
          result,
          parsed.error.message,
          schema
        ) as typeof result;
        if (!repairedRaw?.elements?.length) {
          throw new Error("Template repair returned no elements. Validation errors: " + parsed.error.message);
        }
        template = this.buildTemplateFromRawResult(
          repairedRaw,
          extractionJob,
          organization,
          dataStructure,
          region,
          currency,
          complianceSchema,
          options
        );
        const parsed2 = validateTemplateData(template);
        if (!parsed2.success) {
          throw new Error("Template validation failed after repair: " + parsed2.error.message);
        }
        template = parsed2.data;
      }

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
   * Build TemplateData from raw AI result (enrich elements, derive productTableConfig).
   */
  private buildTemplateFromRawResult(
    raw: RawTemplateGenerationResult,
    extractionJob: ExtractionJob,
    organization: Organization,
    dataStructure: ReturnType<typeof this.analyzeDataStructure>,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    currency: string,
    complianceSchema: { requiredFields: Array<{ binding: string }> },
    options?: { templateName?: string }
  ): TemplateData {
    const enrichedElements = this.enrichElements(
      raw.elements as Parameters<typeof this.enrichElements>[0],
      dataStructure,
      region,
      currency
    );
    if (enrichedElements.length === 0) {
      throw new Error("All template elements were invalid and filtered out. Cannot create template without elements.");
    }

    let productTableConfig: TemplateData["productTableConfig"] = undefined;
    const itemsTable = enrichedElements.find(
      (el): el is Extract<typeof el, { type: "table" }> =>
        el.type === "table" && !!(el as Extract<typeof el, { type: "table" }>).itemsBinding
    );
    if (itemsTable?.itemsBinding && itemsTable.columns?.length) {
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
        let targetCurrency: string | undefined;
        if (bindingLower.includes("description") || bindingLower.includes("name") || bindingLower === "itemdescription") {
          productField = "description";
        } else if (bindingLower.includes("price") || bindingLower.includes("amount") || bindingLower === "unitprice") {
          productField = "price";
          transform = col.type === "currency" ? "currency_convert" : "format_number";
          if (col.type === "currency" && "currency" in col && col.currency) targetCurrency = col.currency;
        } else if (bindingLower === "currency" && col.type === "text") productField = "currency";
        else if (bindingLower.includes("sku") || bindingLower.includes("reference") || bindingLower === "itemnumber") productField = "sku";
        else if (bindingLower.includes("category")) productField = "category";
        else if (bindingLower.includes("tax") && bindingLower.includes("rate")) productField = "taxRate";
        else if (bindingLower.includes("cost")) productField = "cost";
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

    return {
      orgId: organization.id,
      name: options?.templateName || raw.name || `Template from ${extractionJob.fileName}`,
      description: raw.description || `Template generated from extracted invoice: ${extractionJob.fileName}`,
      pageSize: normalizePageSize(raw.pageSize),
      brand: {
        fonts: raw.brand?.fonts || ["Inter"],
        colors: {
          primary: raw.brand?.colors?.primary ?? organization.settings?.brandColors?.primary ?? "#111827",
          secondary: raw.brand?.colors?.secondary ?? organization.settings?.brandColors?.secondary ?? "#6b7280",
          accent: raw.brand?.colors?.accent ?? organization.settings?.brandColors?.accent ?? "#2563eb",
        },
        margins: {
          top: raw.brand?.margins?.top ?? 40,
          right: raw.brand?.margins?.right ?? 40,
          bottom: raw.brand?.margins?.bottom ?? 40,
          left: raw.brand?.margins?.left ?? 40,
        },
      },
      elements: enrichedElements,
      status: "draft",
      ...(raw.layoutModel === "hybrid_v2" || raw.layoutModel === "primitive_v1"
        ? { layoutModel: raw.layoutModel }
        : {}),
      ...(isPlainObject(raw.pageSettings) ? { pageSettings: raw.pageSettings as TemplateData["pageSettings"] } : {}),
      ...(isPlainObject(raw.theme) ? { theme: raw.theme as TemplateData["theme"] } : {}),
      ...(isPlainObject(raw.repeating) ? { repeating: raw.repeating as TemplateData["repeating"] } : {}),
      ...(isPlainObject(raw.referenceLayer) ? { referenceLayer: raw.referenceLayer as TemplateData["referenceLayer"] } : {}),
      ...(Array.isArray(raw.blocksV2) ? { blocksV2: raw.blocksV2 as TemplateData["blocksV2"] } : {}),
      compliance: {
        region,
        requiredFields: complianceSchema.requiredFields.map(f => f.binding),
        autoFooter: true,
        complianceValidated: false,
      },
      ...(productTableConfig && { productTableConfig }),
      schemaVersion: BLOCK_SCHEMA_VERSION,
    };
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

    const visualContext = this.buildVisualLayoutContext(extractionJob);
    if (visualContext) {
      contextParts.push(`\nVisual Layout Signals:\n${visualContext}`);
    }

    // Extracted data sample (bounded for token control)
    const dataSample = JSON.stringify(extractionJob.extractedData, null, 2).substring(0, 3200);
    contextParts.push(`\nExtracted Data Sample:\n${dataSample}`);

    return contextParts.join("\n");
  }

  private buildVisualLayoutContext(extractionJob: ExtractionJob): string {
    const lines: string[] = [];

    if (extractionJob.documentPages?.length) {
      const firstPage = extractionJob.documentPages
        .slice()
        .sort((a, b) => a.pageIndex - b.pageIndex)[0];
      lines.push(
        `- Page 0 size: ${Math.round(firstPage.width)}x${Math.round(firstPage.height)} px`
      );
    }

    if (extractionJob.visionLayout) {
      lines.push(
        `- Vision layout counts: regions=${extractionJob.visionLayout.regions.length}, elements=${extractionJob.visionLayout.elements.length}, tables=${extractionJob.visionLayout.tables.length}, styles=${extractionJob.visionLayout.styleClusters.length}`
      );

      const topRegions = extractionJob.visionLayout.regions.slice(0, 8);
      if (topRegions.length) {
        lines.push("- Regions:");
        for (const region of topRegions) {
          const box = region.boundingBox;
          lines.push(
            `  - ${region.kind} @ (${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}) c=${region.confidence.toFixed(2)}`
          );
        }
      }

      const topTables = extractionJob.visionLayout.tables.slice(0, 4);
      if (topTables.length) {
        lines.push("- Detected tables:");
        for (const table of topTables) {
          const box = table.boundingBox;
          const headers = table.columnHeaders.slice(0, 8).join(", ");
          lines.push(
            `  - table ${table.id} @ (${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}), rows=${table.rowCount}, headers=[${headers}] c=${table.confidence.toFixed(2)}`
          );
        }
      }

      const topStyles = extractionJob.visionLayout.styleClusters.slice(0, 8);
      if (topStyles.length) {
        lines.push("- Style clusters:");
        for (const style of topStyles) {
          lines.push(
            `  - ${style.id}: font=${style.fontFamilyHint || "unknown"} ${style.fontWeightHint || ""} size=${style.fontSizePx ?? "?"} color=${style.color || "?"} c=${style.confidence.toFixed(2)}`
          );
        }
      }
    }

    if (extractionJob.fusionMap?.length) {
      const topFusion = extractionJob.fusionMap
        .slice()
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 30);
      lines.push("- High-confidence binding geometry:");
      for (const entry of topFusion) {
        const box = entry.boundingBox;
        const boxText = box
          ? `(${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)})`
          : "none";
        lines.push(
          `  - ${entry.binding}: type=${entry.fieldType}, bbox=${boxText}, c=${entry.confidence.toFixed(2)}`
        );
      }
    }

    if (extractionJob.fontMatches?.length) {
      const topFonts = extractionJob.fontMatches
        .slice()
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 6)
        .map((font) => `${font.matchedFont} -> ${font.fallbackFont} (${font.confidence.toFixed(2)})`);
      lines.push(`- Font matches: ${topFonts.join("; ")}`);
    }

    return lines.join("\n");
  }

  /**
   * Build prompt for generating template from extraction
   */
  private buildTemplateFromExtractionPrompt(
    context: string,
    dataStructure: ReturnType<typeof this.analyzeDataStructure>,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    organization: Organization,
    options?: TemplateFromExtractionOptions
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

    const arrayPaths = dataStructure.arrays.map((arr) => arr.path);
    const preferredItemsBinding = arrayPaths.includes("items")
      ? "items"
      : (arrayPaths.includes("lineItems") ? "lineItems" : (arrayPaths[0] || "items"));
    const requiredBindingList = requiredFields.map((f) => f.binding).join(", ");
    const arrayPathList = arrayPaths.length > 0 ? arrayPaths.join(", ") : "(none)";
    const targetName = options?.templateName || "Template from Extracted Invoice";
    const schemaGuidance = buildTemplateSchemaGuidance();
    const llmManifest = buildTemplateLlmManifest("template_generation");
    const llmManifestJson = JSON.stringify(llmManifest);

    return `ROLE
You are a Financely invoice-template generation engine. Build a production-ready template JSON for Financely only.

OUTPUT CONTRACT (STRICT)
- Return JSON only. No markdown, no prose, no code fences.
- Return a single object that conforms to the provided JSON schema.
- This JSON will be converted into Financely TemplateData.
- elements[] must be non-empty.

SCHEMA CAPABILITIES
${schemaGuidance}

LLM BLOCK CONTRACT (AUTHORITATIVE JSON)
${llmManifestJson}

FINANCELY RULES (MANDATORY)
1. Use only supported element types and properties from schema.
2. Canvas constraints: x >= 0, y >= 0, width >= 20, height >= 20, x + width <= 794, y + height <= 1123.
3. Use dot-path bindings only (example: seller.name, invoiceDetails.invoiceNumber). Never use Mustache syntax.
4. Static labels must be text elements without binding.
5. Dynamic monetary values must be currency elements (or currency table columns).
6. Dynamic non-monetary scalar values should prefer input elements.
7. For repeating data, use one table element with itemsBinding equal to the extracted array path.
8. Table columns must use column bindings from array item keys (for example description, quantity, unitPrice, total).
9. Keep layout professional and coherent (${styleDescription}); avoid overlapping elements.
10. Ensure compliance-critical bindings are present in generated elements: ${requiredBindingList}
11. For extraction output, prefer layoutModel="primitive_v1" and put final runtime output in elements[].
12. If detected visually, use dedicated element types (image/logo, signature, stamp, qrCode, barcode, line/divider, spacer/pageBreak) rather than approximations.
13. Use style props aggressively for visual fidelity: typography, table header/row/footer styles, image filters/borders/shadows, icon effects, box gradients.

INTERNAL WORKFLOW (DO NOT OUTPUT STAGES)
Stage A: analyze visual/style hints from context.
Stage B: determine layout zones (header, parties, details/meta, table, totals, footer).
Stage C: map extracted fields to bindings.
Stage D: choose element types and typography.
Stage E: apply detailed styling props for near-replica visual output.
Stage F: validate canvas bounds and binding coverage.
Stage G: output final schema-valid JSON object.

CONTEXT
${context}

EXTRACTION HINTS
- Region: ${region}
- Default currency: ${currency}
- Candidate array paths for items table: ${arrayPathList}
- Preferred itemsBinding: ${preferredItemsBinding}
- Target template name: ${targetName}

FINAL JSON TARGET
- name: "${targetName}"
- pageSize: "A4" unless clearly impossible
- layoutModel: "primitive_v1"
- brand: include fonts/colors/margins and infer from visual style
- optional pageSettings/theme/repeating/referenceLayer allowed when useful
- elements: include header labels, seller/buyer, invoice metadata, one items table, subtotal/tax/total, footer
- Use exact field paths from extracted data wherever possible.
`;
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
    elements: RawTemplateElement[],
    _dataStructure: ReturnType<typeof this.analyzeDataStructure>,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    currency: string
  ): TemplateElement[] {
    const CANVAS_WIDTH = 794;
    const CANVAS_HEIGHT = 1123;
    const enriched: TemplateElement[] = [];
    let filteredCount = 0;

    for (const el of elements) {
      const normalizedInput: RawTemplateElement = {
        ...el,
        type: typeof el.type === "string" ? el.type.toLowerCase() : "",
      };

      // Clamp to canvas
      normalizedInput.x = Math.max(0, Math.min(safeNumber(el.x, 0), CANVAS_WIDTH - 20));
      normalizedInput.y = Math.max(0, Math.min(safeNumber(el.y, 0), CANVAS_HEIGHT - 20));
      const maxWidth = CANVAS_WIDTH - normalizedInput.x;
      normalizedInput.width = Math.max(20, Math.min(safeNumber(el.width, 20), maxWidth));
      const maxHeight = CANVAS_HEIGHT - normalizedInput.y;
      normalizedInput.height = Math.max(20, Math.min(safeNumber(el.height, 20), maxHeight));

      // Normalize element based on type
      const normalized = this.normalizeElement(normalizedInput, region, currency);
      if (normalized) {
        enriched.push(normalized);
      } else {
        filteredCount++;
        logger.warn("Element filtered out during normalization", {
          elementId: normalizedInput.id,
          elementType: normalizedInput.type,
          elementX: normalizedInput.x,
          elementY: normalizedInput.y,
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
    el: RawTemplateElement,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    currency: string
  ): TemplateElement | null {
    const elementType = (typeof el.type === "string" ? el.type.toLowerCase() : "") as string;
    
    const base = {
      id: (asString(el.id) || `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: safeNumber(el.rotation, 0),
      zIndex: Math.max(0, Math.round(safeNumber(el.zIndex, 1))),
      visible: asBoolean(el.visible) ?? true,
      ...(asBoolean(el.locked) !== undefined ? { locked: asBoolean(el.locked) } : {}),
      ...(asString(el.groupId) ? { groupId: asString(el.groupId) } : {}),
    };

    switch (elementType) {
      case "text":
        return {
          ...base,
          type: "text",
          text: asString(el.text) || "",
          ...(asString(el.binding) ? { binding: asString(el.binding) } : {}),
          ...(asString(el.calc) ? { calc: asString(el.calc) } : {}),
          typography: normalizeTypography(el.typography),
          format: normalizeFormat(el.format, currency),
          opacity: clamp01(safeNumber(el.opacity, 1)),
          ...(asString(el.backgroundColor) ? { backgroundColor: asString(el.backgroundColor) } : {}),
          ...(isPlainObject(el.shadow) ? { shadow: el.shadow as Record<string, unknown> } : {}),
        } as TemplateElement;

      case "currency":
        return {
          ...base,
          type: "currency",
          ...(asString(el.binding) ? { binding: asString(el.binding) } : {}),
          currency: normalizeCurrencyCode(asString(el.currency), currency),
          currencyLinks: Array.isArray(el.currencyLinks)
            ? (el.currencyLinks.filter(isPlainObject) as Array<Record<string, unknown>>)
            : [],
          mode: normalizeCurrencyMode(el.mode),
          ...(asString(el.formula) ? { formula: asString(el.formula) } : {}),
          placeholder: asString(el.placeholder) || "",
          align: normalizeAlign(el.align),
        } as TemplateElement;

      case "table":
        return {
          ...base,
          type: "table",
          itemsBinding: asString(el.itemsBinding) || "items",
          columns: normalizeTableColumns(el.columns, currency),
          rowHeight: Math.max(12, safeNumber(el.rowHeight, 28)),
          headerHeight: Math.max(0, safeNumber(el.headerHeight, 28)),
          stripe: asBoolean(el.stripe) ?? true,
          designRows: Array.isArray(el.designRows)
            ? (el.designRows.filter(isPlainObject) as Array<{ id: string; values: Record<string, string> }>)
            : [],
          ...(isPlainObject(el.headerStyle) ? { headerStyle: el.headerStyle as Record<string, unknown> } : {}),
          ...(isPlainObject(el.rowStyle) ? { rowStyle: el.rowStyle as Record<string, unknown> } : {}),
          ...(isPlainObject(el.footerStyle) ? { footerStyle: el.footerStyle as Record<string, unknown> } : {}),
          ...(asString(el.headerBackground) ? { headerBackground: asString(el.headerBackground) } : {}),
          ...(asString(el.rowBackground) ? { rowBackground: asString(el.rowBackground) } : {}),
          ...(asString(el.alternateRowBackground) ? { alternateRowBackground: asString(el.alternateRowBackground) } : {}),
          ...(asString(el.footerBackground) ? { footerBackground: asString(el.footerBackground) } : {}),
          ...(normalizeTableBorderStyle(el.borderStyle) ? { borderStyle: normalizeTableBorderStyle(el.borderStyle) } : {}),
          ...(asString(el.borderColor) ? { borderColor: asString(el.borderColor) } : {}),
          ...(typeof el.borderWidth === "number" ? { borderWidth: safeNumber(el.borderWidth, 1) } : {}),
          ...(isPlainObject(el.cellPadding) ? { cellPadding: el.cellPadding as Record<string, unknown> } : {}),
          ...(isPlainObject(el.shadow) ? { shadow: el.shadow as Record<string, unknown> } : {}),
          ...(asBoolean(el.showFooter) !== undefined ? { showFooter: asBoolean(el.showFooter) } : {}),
        } as TemplateElement;

      case "input":
        return {
          ...base,
          type: "input",
          ...(asString(el.binding) ? { binding: asString(el.binding) } : {}),
          placeholder: asString(el.placeholder) || "",
          variant: normalizeInputVariant(el.variant),
          align: normalizeAlign(el.align),
        } as TemplateElement;

      case "box":
        return {
          ...base,
          type: "box",
          fill: asString(el.fill) || "#ffffff00",
          ...(normalizeShape(el.shape) ? { shape: normalizeShape(el.shape) } : {}),
          ...(typeof el.points === "number" ? { points: Math.round(safeNumber(el.points, 4)) } : {}),
          ...(asString(el.clipPath) ? { clipPath: asString(el.clipPath) } : {}),
          ...(isPlainObject(el.fillGradient) ? { fillGradient: el.fillGradient as Record<string, unknown> } : {}),
          stroke: asString(el.stroke) || "#e5e7eb",
          ...(normalizeStrokeStyle(el.strokeStyle) ? { strokeStyle: normalizeStrokeStyle(el.strokeStyle) } : {}),
          strokeWidth: safeNumber(el.strokeWidth, 1),
          radius: safeNumber(el.radius, 0),
          opacity: clamp01(safeNumber(el.opacity, 1)),
          ...(isPlainObject(el.shadow) ? { shadow: el.shadow as Record<string, unknown> } : {}),
        } as TemplateElement;

      case "line":
        return {
          ...base,
          type: "line",
          x2: safeNumber(el.x2, el.x + el.width),
          y2: safeNumber(el.y2, el.y),
          stroke: asString(el.stroke) || "#e5e7eb",
          strokeWidth: safeNumber(el.strokeWidth, 1),
          ...(normalizeLineStyle(el.style) ? { style: normalizeLineStyle(el.style) } : {}),
          ...(normalizeLinePattern(el.pattern) ? { pattern: normalizeLinePattern(el.pattern) } : {}),
          ...(normalizeAlign(el.align) ? { align: normalizeAlign(el.align) } : {}),
          ...(typeof el.opacity === "number" ? { opacity: clamp01(safeNumber(el.opacity, 1)) } : {}),
          ...(isPlainObject(el.gradient) ? { gradient: el.gradient as Record<string, unknown> } : {}),
          ...(isPlainObject(el.shadow) ? { shadow: el.shadow as Record<string, unknown> } : {}),
        } as TemplateElement;

      case "icon":
        return {
          ...base,
          type: "icon",
          iconName: asString(el.iconName) || "file-text",
          color: asString(el.color) || "#111827",
          ...(normalizeIconLibrary(el.library) ? { library: normalizeIconLibrary(el.library) } : {}),
          ...(asString(el.customIconUrl) ? { customIconUrl: asString(el.customIconUrl) } : {}),
          ...(asString(el.backgroundColor) ? { backgroundColor: asString(el.backgroundColor) } : {}),
          ...(isPlainObject(el.border) ? { border: el.border as Record<string, unknown> } : {}),
          ...(normalizeIconShape(el.shape) ? { shape: normalizeIconShape(el.shape) } : {}),
          ...(normalizeIconFlip(el.flip) ? { flip: normalizeIconFlip(el.flip) } : {}),
          ...(normalizeIconEffect(el.effect) ? { effect: normalizeIconEffect(el.effect) } : {}),
          ...(asString(el.link) ? { link: asString(el.link) } : {}),
          ...(asString(el.tooltip) ? { tooltip: asString(el.tooltip) } : {}),
        } as TemplateElement;

      case "image": {
        const src = asString(el.src);
        if (!src) {
          return null;
        }
        return {
          ...base,
          type: "image",
          src,
          ...(asString(el.binding) ? { binding: asString(el.binding) } : {}),
          objectFit: normalizeObjectFit(el.objectFit),
          ...(asString(el.objectPosition) ? { objectPosition: asString(el.objectPosition) } : {}),
          ...(typeof el.opacity === "number" ? { opacity: clamp01(safeNumber(el.opacity, 1)) } : {}),
          ...(isPlainObject(el.border) ? { border: el.border as Record<string, unknown> } : {}),
          ...(isPlainObject(el.shadow) ? { shadow: el.shadow as Record<string, unknown> } : {}),
          ...(isPlainObject(el.filter) ? { filter: el.filter as Record<string, unknown> } : {}),
          ...(isPlainObject(el.overlay) ? { overlay: el.overlay as Record<string, unknown> } : {}),
          ...(isPlainObject(el.padding) ? { padding: el.padding as Record<string, unknown> } : {}),
          ...(isPlainObject(el.margin) ? { margin: el.margin as Record<string, unknown> } : {}),
          ...(normalizeImageShape(el.shape) ? { shape: normalizeImageShape(el.shape) } : {}),
          ...(asString(el.clipPath) ? { clipPath: asString(el.clipPath) } : {}),
          ...(asString(el.link) ? { link: asString(el.link) } : {}),
          ...(asString(el.alt) ? { alt: asString(el.alt) } : {}),
        } as TemplateElement;
      }

      case "spacer":
        return {
          ...base,
          type: "spacer",
          showDivider: asBoolean(el.showDivider) ?? false,
          dividerStyle: normalizeSpacerDividerStyle(el.dividerStyle),
          dividerColor: asString(el.dividerColor) || "#d1d5db",
          dividerWidth: safeNumber(el.dividerWidth, 1),
        } as TemplateElement;

      case "pagebreak":
      case "pageBreak":
        return {
          ...base,
          type: "pageBreak",
          breakType: normalizeBreakType(el.breakType),
          showInEditor: asBoolean(el.showInEditor) ?? true,
          style: normalizePageBreakStyle(el.style),
        } as TemplateElement;

      case "qrcode":
      case "qrCode":
        return {
          ...base,
          type: "qrCode",
          content: asString(el.content) || "",
          ...(asString(el.binding) ? { binding: asString(el.binding) } : {}),
          dataType: normalizeQrDataType(el.dataType),
          foregroundColor: asString(el.foregroundColor) || "#111827",
          backgroundColor: asString(el.backgroundColor) || "#ffffff",
          errorCorrection: normalizeQrErrorCorrection(el.errorCorrection),
          margin: Math.max(0, safeNumber(el.margin, 2)),
          ...(isPlainObject(el.border) ? { border: el.border as Record<string, unknown> } : {}),
          ...(isPlainObject(el.logo) ? { logo: el.logo as Record<string, unknown> } : {}),
        } as TemplateElement;

      case "barcode":
        return {
          ...base,
          type: "barcode",
          value: asString(el.value) || "",
          ...(asString(el.binding) ? { binding: asString(el.binding) } : {}),
          format: normalizeBarcodeFormat(el.format),
          color: asString(el.color) || "#111827",
          backgroundColor: asString(el.backgroundColor) || "#ffffff",
          showText: asBoolean(el.showText) ?? true,
          textPosition: normalizeBarcodeTextPosition(el.textPosition),
        } as TemplateElement;

      case "signature":
        return {
          ...base,
          type: "signature",
          signatureType: normalizeSignatureType(el.signatureType),
          ...(asString(el.signatureImage) ? { signatureImage: asString(el.signatureImage) } : {}),
          ...(asString(el.signatureName) ? { signatureName: asString(el.signatureName) } : {}),
          ...(asString(el.signatureTitle) ? { signatureTitle: asString(el.signatureTitle) } : {}),
          showDate: asBoolean(el.showDate) ?? false,
          ...(isPlainObject(el.borderBottom) ? { borderBottom: el.borderBottom as Record<string, unknown> } : {}),
          placeholderText: asString(el.placeholderText) || "Signature",
        } as TemplateElement;

      case "stamp":
        return {
          ...base,
          type: "stamp",
          text: asString(el.text) || "PAID",
          stampType: normalizeStampType(el.stampType),
          shape: normalizeStampShape(el.shape),
          size: Math.max(20, safeNumber(el.size, 120)),
          fontFamily: asString(el.fontFamily) || "Inter",
          fontSize: Math.max(8, safeNumber(el.fontSize, 24)),
          fontWeight: normalizeFontWeight(el.fontWeight),
          textColor: asString(el.textColor) || "#991b1b",
          backgroundColor: asString(el.backgroundColor) || "#fee2e2",
          ...(isPlainObject(el.border) ? { border: el.border as Record<string, unknown> } : {}),
          opacity: clamp01(safeNumber(el.opacity, 0.85)),
          effect: normalizeStampEffect(el.effect),
          pattern: normalizeStampPattern(el.pattern),
        } as TemplateElement;

      default:
        logger.warn("Unknown element type, filtering out", {
          elementId: el.id,
          elementType: el.type,
          region,
        });
        return null;
    }
  }
}

function normalizeTypography(raw: unknown): Record<string, unknown> {
  const value = isPlainObject(raw) ? raw : {};
  return {
    fontFamily: asString(value.fontFamily) || "Inter",
    fontSize: Math.max(6, safeNumber(value.fontSize, 12)),
    fontWeight: normalizeFontWeight(value.fontWeight),
    ...(normalizeFontStyle(value.fontStyle) ? { fontStyle: normalizeFontStyle(value.fontStyle) } : {}),
    lineHeight: safeNumber(value.lineHeight, 1.2),
    letterSpacing: safeNumber(value.letterSpacing, 0),
    ...(typeof value.wordSpacing === "number" ? { wordSpacing: safeNumber(value.wordSpacing, 0) } : {}),
    color: asString(value.color) || "#111827",
    align: normalizeTextAlign(value.align),
    uppercase: asBoolean(value.uppercase) ?? false,
    lowercase: asBoolean(value.lowercase) ?? false,
    ...(normalizeTextDecoration(value.textDecoration) ? { textDecoration: normalizeTextDecoration(value.textDecoration) } : {}),
    ...(typeof value.textIndent === "number" ? { textIndent: Math.max(0, safeNumber(value.textIndent, 0)) } : {}),
  };
}

function normalizeFormat(raw: unknown, currency: string): Record<string, unknown> {
  const value = isPlainObject(raw) ? raw : {};
  const kind = normalizeFormatKind(value.kind);
  if (kind === "currency") {
    return {
      kind,
      currency: normalizeCurrencyCode(asString(value.currency), currency),
    };
  }
  if (kind === "date") {
    return {
      kind,
      ...(asString(value.dateFormat) ? { dateFormat: asString(value.dateFormat) } : {}),
    };
  }
  return { kind: "none" };
}

function normalizeTableColumns(raw: unknown, currency: string): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry, index) => {
      if (!isPlainObject(entry)) return null;
      const columnType = normalizeColumnType(entry.type);
      const columnCurrency = normalizeCurrencyCode(asString(entry.currency), currency);
      const format = normalizeFormat(entry.format, columnCurrency);
      const column: Record<string, unknown> = {
        id: asString(entry.id) || `column-${index + 1}`,
        header: asString(entry.header) || `Column ${index + 1}`,
        width: normalizeTableColumnWidth(entry.width, raw.length),
        align: normalizeAlign(entry.align),
        type: columnType,
        format,
        showTotal: asBoolean(entry.showTotal) ?? (columnType === "currency" || columnType === "number"),
      };

      if (asString(entry.binding)) {
        column.binding = asString(entry.binding);
      }
      if (asString(entry.calc)) {
        column.calc = asString(entry.calc);
      }
      if (columnType === "currency") {
        column.currency = columnCurrency;
        if (Array.isArray(entry.currencyLinks)) {
          column.currencyLinks = entry.currencyLinks.filter(isPlainObject);
        }
        const mode = normalizeCurrencyMode(entry.mode);
        if (mode !== "independent") {
          column.mode = mode;
        }
      }
      if (isPlainObject(entry.totalStyle)) {
        column.totalStyle = entry.totalStyle;
      }

      return column;
    })
    .filter((column): column is Record<string, unknown> => column !== null);
}

function normalizePageSize(pageSize: unknown): "A4" | "Letter" | "Legal" {
  const normalized = asString(pageSize);
  if (normalized === "Letter") return "Letter";
  if (normalized === "Legal") return "Legal";
  return "A4";
}

function normalizeTableColumnWidth(value: unknown, columnCount: number): string {
  const trackRegex = /^([0-9]*\.?[0-9]+)\s*(%|fr)$/i;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    const match = trackRegex.exec(trimmed);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        return `${Math.round(parsed * 100) / 100}${match[2]}`;
      }
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && numeric > 0) {
      return `${Math.round(numeric * 100) / 100}fr`;
    }
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${Math.round(value * 100) / 100}fr`;
  }
  const fallbackPercent = 100 / Math.max(1, columnCount);
  return `${Math.round(fallbackPercent * 100) / 100}%`;
}

function normalizeCurrencyCode(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const code = value.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) return code;
  return fallback;
}

function normalizeCurrencyMode(value: unknown): "independent" | "linked" | "formula" {
  const normalized = asString(value);
  if (normalized === "linked") return "linked";
  if (normalized === "formula") return "formula";
  return "independent";
}

function normalizeInputVariant(value: unknown): "text" | "number" | "date" {
  const normalized = asString(value);
  if (normalized === "number") return "number";
  if (normalized === "date") return "date";
  return "text";
}

function normalizeColumnType(value: unknown): "text" | "number" | "date" | "currency" {
  const normalized = asString(value);
  if (normalized === "number") return "number";
  if (normalized === "date") return "date";
  if (normalized === "currency") return "currency";
  return "text";
}

function normalizeAlign(value: unknown): "left" | "center" | "right" {
  const normalized = asString(value);
  if (normalized === "center") return "center";
  if (normalized === "right") return "right";
  return "left";
}

function normalizeTextAlign(value: unknown): "left" | "center" | "right" | "justify" {
  const normalized = asString(value);
  if (normalized === "center") return "center";
  if (normalized === "right") return "right";
  if (normalized === "justify") return "justify";
  return "left";
}

function normalizeObjectFit(value: unknown): "contain" | "cover" | "fill" | "none" | "scale-down" {
  const normalized = asString(value);
  if (normalized === "cover") return "cover";
  if (normalized === "fill") return "fill";
  if (normalized === "none") return "none";
  if (normalized === "scale-down") return "scale-down";
  return "contain";
}

function normalizeTableBorderStyle(value: unknown): "none" | "rows" | "columns" | "all" | "outer" | null {
  const normalized = asString(value);
  if (normalized === "none" || normalized === "rows" || normalized === "columns" || normalized === "all" || normalized === "outer") {
    return normalized;
  }
  return null;
}

function normalizeStrokeStyle(value: unknown): "solid" | "dashed" | "dotted" | null {
  const normalized = asString(value);
  if (normalized === "solid" || normalized === "dashed" || normalized === "dotted") return normalized;
  return null;
}

function normalizeLineStyle(value: unknown): "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge" | null {
  const normalized = asString(value);
  if (normalized === "solid" || normalized === "dashed" || normalized === "dotted" || normalized === "double" || normalized === "groove" || normalized === "ridge") {
    return normalized;
  }
  return null;
}

function normalizeLinePattern(value: unknown): "line" | "wave" | "zigzag" | "dots" | "custom" | null {
  const normalized = asString(value);
  if (normalized === "line" || normalized === "wave" || normalized === "zigzag" || normalized === "dots" || normalized === "custom") {
    return normalized;
  }
  return null;
}

function normalizeShape(value: unknown): "rectangle" | "circle" | "triangle" | "polygon" | "custom" | null {
  const normalized = asString(value);
  if (normalized === "rectangle" || normalized === "circle" || normalized === "triangle" || normalized === "polygon" || normalized === "custom") {
    return normalized;
  }
  return null;
}

function normalizeImageShape(value: unknown): "rectangle" | "circle" | "custom" | null {
  const normalized = asString(value);
  if (normalized === "rectangle" || normalized === "circle" || normalized === "custom") return normalized;
  return null;
}

function normalizeIconLibrary(value: unknown): "lucide" | "fontawesome" | "material" | "custom" | null {
  const normalized = asString(value);
  if (normalized === "lucide" || normalized === "fontawesome" || normalized === "material" || normalized === "custom") return normalized;
  return null;
}

function normalizeIconShape(value: unknown): "none" | "circle" | "square" | "rounded" | null {
  const normalized = asString(value);
  if (normalized === "none" || normalized === "circle" || normalized === "square" || normalized === "rounded") return normalized;
  return null;
}

function normalizeIconFlip(value: unknown): "none" | "horizontal" | "vertical" | "both" | null {
  const normalized = asString(value);
  if (normalized === "none" || normalized === "horizontal" || normalized === "vertical" || normalized === "both") return normalized;
  return null;
}

function normalizeIconEffect(value: unknown): "none" | "shadow" | "glow" | "outline" | null {
  const normalized = asString(value);
  if (normalized === "none" || normalized === "shadow" || normalized === "glow" || normalized === "outline") return normalized;
  return null;
}

function normalizeSpacerDividerStyle(value: unknown): "solid" | "dashed" | "dotted" {
  const normalized = asString(value);
  if (normalized === "dashed") return "dashed";
  if (normalized === "dotted") return "dotted";
  return "solid";
}

function normalizeBreakType(value: unknown): "always" | "avoid" | "auto" {
  const normalized = asString(value);
  if (normalized === "avoid") return "avoid";
  if (normalized === "auto") return "auto";
  return "always";
}

function normalizePageBreakStyle(value: unknown): "line" | "dashed" | "none" {
  const normalized = asString(value);
  if (normalized === "line") return "line";
  if (normalized === "none") return "none";
  return "dashed";
}

function normalizeQrDataType(value: unknown): "url" | "text" | "payment" | "custom" {
  const normalized = asString(value);
  if (normalized === "url" || normalized === "payment" || normalized === "custom") return normalized;
  return "text";
}

function normalizeQrErrorCorrection(value: unknown): "low" | "medium" | "high" | "ultra" {
  const normalized = asString(value);
  if (normalized === "low" || normalized === "high" || normalized === "ultra") return normalized;
  return "medium";
}

function normalizeBarcodeFormat(value: unknown): "CODE128" | "CODE39" | "EAN13" | "UPC" {
  const normalized = asString(value)?.toUpperCase();
  if (normalized === "CODE39" || normalized === "EAN13" || normalized === "UPC") return normalized;
  return "CODE128";
}

function normalizeBarcodeTextPosition(value: unknown): "top" | "bottom" {
  const normalized = asString(value);
  if (normalized === "top") return "top";
  return "bottom";
}

function normalizeSignatureType(value: unknown): "placeholder" | "image" | "drawn" {
  const normalized = asString(value);
  if (normalized === "image" || normalized === "drawn") return normalized;
  return "placeholder";
}

function normalizeStampType(value: unknown): "paid" | "overdue" | "draft" | "void" | "custom" {
  const normalized = asString(value);
  if (normalized === "overdue" || normalized === "draft" || normalized === "void" || normalized === "custom") return normalized;
  return "paid";
}

function normalizeStampShape(value: unknown): "rectangle" | "circle" | "badge" | "custom" {
  const normalized = asString(value);
  if (normalized === "circle" || normalized === "badge" || normalized === "custom") return normalized;
  return "rectangle";
}

function normalizeStampEffect(value: unknown): "stamped" | "embossed" | "flat" {
  const normalized = asString(value);
  if (normalized === "embossed" || normalized === "flat") return normalized;
  return "stamped";
}

function normalizeStampPattern(value: unknown): "diagonal-lines" | "dots" | "none" {
  const normalized = asString(value);
  if (normalized === "dots" || normalized === "none") return normalized;
  return "diagonal-lines";
}

function normalizeFontWeight(value: unknown): "normal" | "medium" | "semibold" | "bold" {
  const normalized = asString(value);
  if (normalized === "medium" || normalized === "semibold" || normalized === "bold") return normalized;
  return "normal";
}

function normalizeFontStyle(value: unknown): "normal" | "italic" | null {
  const normalized = asString(value);
  if (normalized === "italic") return "italic";
  if (normalized === "normal") return "normal";
  return null;
}

function normalizeTextDecoration(value: unknown): "none" | "underline" | "line-through" | null {
  const normalized = asString(value);
  if (normalized === "none" || normalized === "underline" || normalized === "line-through") return normalized;
  return null;
}

function normalizeFormatKind(value: unknown): "none" | "currency" | "date" {
  const normalized = asString(value);
  if (normalized === "currency" || normalized === "date") return normalized;
  return "none";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function safeNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
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
