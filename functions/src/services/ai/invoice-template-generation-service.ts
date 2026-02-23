import { logger } from "firebase-functions";
import { AIService } from "./ai-service";
import { getAIService } from "./ai-service";
import {
  BLOCK_SCHEMA_VERSION,
  buildTemplateLlmManifest,
  buildTemplateGenerationSchema,
  buildTemplateSchemaGuidance,
} from "../../core/block-registry";
import { TemplateData, TemplateElement } from "../../core/entities/template";
import { Organization } from "../../core/entities/organization";
import { COMPLIANCE_SCHEMAS } from "../../core/entities/invoice-compliance";
import { validateTemplateCompliance } from "../../utils/invoice-compliance";
import { formatProductFieldsForAI } from "../../utils/product-fields";
import { validateTemplateData, repairTemplateGenerationRaw } from "./template-generation-validate-repair";
import type { JSONSchema } from "./ai-service";
import { clampTemplateElementsToPrintableArea } from "../../utils/template-printable-bounds";
import { stabilizeTemplateLayout } from "../../utils/template-layout-stability";

const STANDARD_PRINT_MARGINS_PX = { top: 96, right: 96, bottom: 96, left: 96 };

/**
 * Service for generating invoice templates using AI
 * Creates beautiful, functional, and fully compliant invoice templates
 */
export class InvoiceTemplateGenerationService {
  private aiService: AIService;
  private currentCurrency: string = "USD";
  private currentRegion: "US" | "EU" | "CA" | "AU" | "UK" = "US";

  constructor(aiService?: AIService) {
    this.aiService = aiService || getAIService();
  }

  /**
   * Generate an invoice template based on organization context and compliance region
   */
  async generateInvoiceTemplate(
    organization: Organization,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional";
      includeLogo?: boolean;
      customPrompt?: string;
    }
  ): Promise<TemplateData> {
    // Build context from organization data
    const context = this.buildOrganizationContext(organization, region);
    
    // Get compliance requirements for the region
    const complianceSchema = COMPLIANCE_SCHEMAS[region];
    const requiredFields = complianceSchema.requiredFields.map(f => ({
      binding: f.binding,
      label: f.label,
      description: f.description,
      format: f.format,
    }));
    
    // Create prompt for AI
    const prompt = this.buildTemplatePrompt(context, requiredFields, region, organization, options);

    const baseSchema = buildTemplateGenerationSchema();
    const schema = {
      type: "object" as const,
      required: baseSchema.required,
      properties: {
        ...(baseSchema.properties as Record<string, unknown>),
        productTableConfig: {
          type: "object",
          properties: {
            itemsBinding: { type: "string", description: "The items binding path for the table (e.g., 'items')" },
            columnMappings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  columnBinding: { type: "string", description: "The table column binding" },
                  productField: {
                    type: "string",
                    enum: ["name", "description", "price", "currency", "sku", "barcode", "category", "taxRate", "cost"],
                    description: "The product entity field to map from",
                  },
                  transform: {
                    type: "string",
                    enum: ["none", "currency_convert", "format_number"],
                  },
                  targetCurrency: { type: "string" },
                  lockOnProductSelect: { type: "boolean" },
                },
                required: ["columnBinding", "productField"],
              },
            },
            autoQuantity: { type: "boolean" },
            defaultQuantity: { type: "number" },
            autoConvertCurrency: { type: "boolean" },
            defaultCurrency: { type: "string" },
          },
          required: ["itemsBinding", "columnMappings"],
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
          type: "text" | "image" | "table" | "box" | "line" | "input" | "currency" | "icon";
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
          iconName?: string;
          color?: string;
        }>;
        productTableConfig?: {
          itemsBinding: string;
          columnMappings: Array<{
            columnBinding: string;
            productField: "name" | "description" | "price" | "currency" | "sku" | "barcode" | "category" | "taxRate" | "cost";
            transform?: "none" | "currency_convert" | "format_number";
            targetCurrency?: string;
            lockOnProductSelect?: boolean;
          }>;
          autoQuantity?: boolean;
          defaultQuantity?: number;
          autoConvertCurrency?: boolean;
          defaultCurrency?: string;
        };
      }>(prompt, schema as unknown as JSONSchema, {
        temperature: 0.7,
        maxTokens: 16384, // Large token limit for complex template structures
      });
      
      // Validate and enrich the generated template
      const enrichedElements = this.enrichElements(result.elements, requiredFields, region, organization);
      
      // Generate productTableConfig if AI provided it, or create a default one
      let productTableConfig: TemplateData["productTableConfig"] = undefined;
      if (result.productTableConfig) {
        // Use AI-generated config
        productTableConfig = {
          itemsBinding: result.productTableConfig.itemsBinding,
          columnMappings: result.productTableConfig.columnMappings.map(m => ({
            columnBinding: m.columnBinding,
            productField: m.productField,
            transform: m.transform || "none",
            targetCurrency: m.targetCurrency,
            lockOnProductSelect: m.lockOnProductSelect !== false, // Default to true
          })),
          autoQuantity: result.productTableConfig.autoQuantity || false,
          defaultQuantity: result.productTableConfig.defaultQuantity || 1,
          autoConvertCurrency: result.productTableConfig.autoConvertCurrency !== false, // Default to true
          defaultCurrency: result.productTableConfig.defaultCurrency || organization.settings?.defaultCurrency || "USD",
        };
      } else {
        // Generate default productTableConfig based on the table elements
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
              defaultCurrency: organization.settings?.defaultCurrency || "USD",
            };
          }
        }
      }
      
      let template: TemplateData = {
        orgId: organization.id,
        name: result.name || `${region} Invoice Template`,
        description: result.description,
        pageSize: result.pageSize || "A4",
        brand: {
          fonts: result.brand?.fonts || ["Inter"],
          colors: result.brand?.colors || {
            primary: organization.settings?.brandColors?.primary || "#111827",
            secondary: organization.settings?.brandColors?.secondary || "#6b7280",
            accent: organization.settings?.brandColors?.accent || "#2563eb",
          },
          margins: result.brand?.margins || STANDARD_PRINT_MARGINS_PX,
        },
        elements: enrichedElements,
        status: "draft",
        compliance: {
          region,
          requiredFields: requiredFields.map(f => f.binding),
          autoFooter: true,
          complianceValidated: false,
        },
        ...(productTableConfig && { productTableConfig }),
        schemaVersion: BLOCK_SCHEMA_VERSION,
      };

      const parsed = validateTemplateData(template);
      if (!parsed.success) {
        logger.warn("Template validation failed, attempting one-shot repair", { organizationId: organization.id, region });
        const repairedRaw = await repairTemplateGenerationRaw(
          this.aiService,
          result,
          parsed.error.message,
          schema as unknown as JSONSchema
        ) as typeof result;
        if (!repairedRaw?.elements?.length) {
          throw new Error("Template repair returned no elements. Validation errors: " + parsed.error.message);
        }
        const enrichedElements2 = this.enrichElements(repairedRaw.elements, requiredFields, region, organization);
        let productTableConfig2: TemplateData["productTableConfig"] = undefined;
        if (repairedRaw.productTableConfig) {
          productTableConfig2 = {
            itemsBinding: repairedRaw.productTableConfig.itemsBinding,
            columnMappings: repairedRaw.productTableConfig.columnMappings.map(m => ({
              columnBinding: m.columnBinding,
              productField: m.productField,
              transform: (m.transform || "none") as "none" | "currency_convert" | "format_number",
              targetCurrency: m.targetCurrency,
              lockOnProductSelect: m.lockOnProductSelect !== false,
            })),
            autoQuantity: repairedRaw.productTableConfig.autoQuantity ?? false,
            defaultQuantity: repairedRaw.productTableConfig.defaultQuantity ?? 1,
            autoConvertCurrency: repairedRaw.productTableConfig.autoConvertCurrency !== false,
            defaultCurrency: repairedRaw.productTableConfig.defaultCurrency || organization.settings?.defaultCurrency || "USD",
          };
        } else {
          const itemsTable2 = enrichedElements2.find(
            (el): el is Extract<typeof el, { type: "table" }> =>
              el.type === "table" && !!(el as Extract<typeof el, { type: "table" }>).itemsBinding
          );
          if (itemsTable2?.itemsBinding && itemsTable2.columns?.length) {
            const columnMappings2: Array<{
              columnBinding: string;
              productField: "name" | "description" | "price" | "currency" | "sku" | "barcode" | "category" | "taxRate" | "cost";
              transform: "none" | "currency_convert" | "format_number";
              targetCurrency?: string;
              lockOnProductSelect: boolean;
            }> = [];
            for (const col of itemsTable2.columns) {
              if (!col.binding) continue;
              const bindingLower = col.binding.toLowerCase();
              let productField: "name" | "description" | "price" | "currency" | "sku" | "barcode" | "category" | "taxRate" | "cost" | null = null;
              let transform: "none" | "currency_convert" | "format_number" = "none";
              let targetCurrency: string | undefined;
              if (bindingLower.includes("description") || bindingLower.includes("name") || bindingLower === "itemdescription") productField = "description";
              else if (bindingLower.includes("price") || bindingLower.includes("amount") || bindingLower === "unitprice") {
                productField = "price";
                transform = col.type === "currency" ? "currency_convert" : "format_number";
                if (col.type === "currency" && "currency" in col && col.currency) targetCurrency = col.currency;
              } else if (bindingLower === "currency" && col.type === "text") productField = "currency";
              else if (bindingLower.includes("sku") || bindingLower.includes("reference") || bindingLower === "itemnumber") productField = "sku";
              else if (bindingLower.includes("category")) productField = "category";
              else if (bindingLower.includes("tax") && bindingLower.includes("rate")) productField = "taxRate";
              else if (bindingLower.includes("cost")) productField = "cost";
              if (productField) columnMappings2.push({ columnBinding: col.binding, productField, transform, targetCurrency, lockOnProductSelect: true });
            }
            if (columnMappings2.length > 0) {
              productTableConfig2 = {
                itemsBinding: itemsTable2.itemsBinding,
                columnMappings: columnMappings2,
                autoQuantity: false,
                defaultQuantity: 1,
                autoConvertCurrency: true,
                defaultCurrency: organization.settings?.defaultCurrency || "USD",
              };
            }
          }
        }
        const template2: TemplateData = {
          orgId: organization.id,
          name: repairedRaw.name || `${region} Invoice Template`,
          description: repairedRaw.description,
          pageSize: repairedRaw.pageSize || "A4",
          brand: {
            fonts: repairedRaw.brand?.fonts || ["Inter"],
            colors: repairedRaw.brand?.colors ?? {
              primary: organization.settings?.brandColors?.primary || "#111827",
              secondary: organization.settings?.brandColors?.secondary || "#6b7280",
              accent: organization.settings?.brandColors?.accent || "#2563eb",
            },
            margins: repairedRaw.brand?.margins ?? STANDARD_PRINT_MARGINS_PX,
          },
          elements: enrichedElements2,
          status: "draft",
          compliance: {
            region,
            requiredFields: requiredFields.map(f => f.binding),
            autoFooter: true,
            complianceValidated: false,
          },
          ...(productTableConfig2 && { productTableConfig: productTableConfig2 }),
          schemaVersion: BLOCK_SCHEMA_VERSION,
        };
        const parsed2 = validateTemplateData(template2);
        if (!parsed2.success) {
          throw new Error("Template validation failed after repair: " + parsed2.error.message);
        }
        template = parsed2.data;
      }

      // Validate template compliance (using validateTemplateCompliance directly with elements)
      const missingBindings = validateTemplateCompliance(template.elements, region);
      if (missingBindings.length > 0) {
        logger.warn("Generated template has compliance issues", {
          missingBindings,
        });
        // Try to fix missing bindings
        template.elements = this.addMissingRequiredFields(
          template.elements,
          missingBindings,
          requiredFields
        );
      }

      // Stabilize AI layout first, then keep all elements inside printable bounds.
      template = stabilizeTemplateLayout(template);
      template = clampTemplateElementsToPrintableArea(template);
      const boundedParse = validateTemplateData(template);
      if (!boundedParse.success) {
        throw new Error("Template validation failed after boundary clamp: " + boundedParse.error.message);
      }
      template = boundedParse.data;
      
      logger.info("Invoice template generated successfully", {
        organizationId: organization.id,
        region,
        elementCount: template.elements.length,
      });
      
      return template;
    } catch (error) {
      logger.error("Failed to generate invoice template", {
        error: error instanceof Error ? error.message : "Unknown error",
        organizationId: organization.id,
        region,
      });
      throw new Error(
        `Failed to generate invoice template: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Build context string from organization data
   */
  private buildOrganizationContext(
    orgData: Organization,
    region: "US" | "EU" | "CA" | "AU" | "UK"
  ): string {
    const parts: string[] = [];
    
    parts.push(`Organization: ${orgData.name || "Company"}`);
    
    if (orgData.description) {
      parts.push(`Description: ${orgData.description}`);
    }
    
    if (orgData.settings?.address) {
      const addr = orgData.settings.address;
      parts.push(`Address: ${[addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(", ")}`);
    }
    
    if (orgData.settings?.email) {
      parts.push(`Email: ${orgData.settings.email}`);
    }
    
    if (orgData.settings?.phone) {
      parts.push(`Phone: ${orgData.settings.phone}`);
    }
    
    if (orgData.settings?.brandColors) {
      const brandColors = orgData.settings.brandColors;
      parts.push(`Brand Colors: Primary ${brandColors.primary || "#111827"}, Secondary ${brandColors.secondary || "#6b7280"}, Accent ${brandColors.accent || "#2563eb"}`);
    }
    
    // Determine currency based on region if not set in org settings
    let currency = orgData.settings?.defaultCurrency;
    if (!currency) {
      // Set default currency based on region
      const regionCurrencyMap: Record<"US" | "EU" | "CA" | "AU" | "UK", string> = {
        US: "USD",
        EU: "EUR",
        CA: "CAD",
        AU: "AUD",
        UK: "GBP",
      };
      currency = regionCurrencyMap[region] || "USD";
    }
    
    if (currency) {
      parts.push(`Default Currency: ${currency}`);
    }
    
    parts.push(`\nCompliance Region: ${region}`);
    parts.push(`This invoice template must comply with ${region} invoice requirements.`);
    parts.push(`🚨 CRITICAL: For ${region} region, use currency ${currency} (NOT USD unless explicitly specified). All monetary fields and table columns must use ${currency}.`);
    
    return parts.join("\n");
  }

  /**
   * Build the prompt for AI template generation
   */
  private buildTemplatePrompt(
    context: string,
    requiredFields: Array<{ binding: string; label: string; description?: string; format?: string }>,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    organization: Organization,
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional";
      includeLogo?: boolean;
      customPrompt?: string;
    }
  ): string {
    const style = options?.style || "modern";
    const includeLogo = options?.includeLogo ?? true;
    const regionCurrencyMap: Record<"US" | "EU" | "CA" | "AU" | "UK", string> = {
      US: "USD",
      EU: "EUR",
      CA: "CAD",
      AU: "AUD",
      UK: "GBP",
    };
    const currency = organization.settings?.defaultCurrency || regionCurrencyMap[region] || "USD";
    const requiredList = requiredFields.map(f => `${f.binding} (${f.label})`).join("; ");
    const schemaGuidance = buildTemplateSchemaGuidance();
    const llmManifest = buildTemplateLlmManifest("template_generation");
    const llmManifestJson = JSON.stringify(llmManifest);

    return `Generate a valid invoice template that conforms to the attached schema. Use ONLY supported element types/properties from the schema. The elements array is REQUIRED and must not be empty.

Rules: All monetary values use Currency elements (not Input). Table price columns use type="currency" with currency code. Fields with bindings must be Input or Currency; Text is for static labels only. Canvas 794×1123: every element must satisfy x+width≤794, y+height≤1123. Text-bearing elements must have enough height to avoid clipping/overflow. Do not overlap text/input/currency/table content elements unless intentional. Use only organization data from context; do not invent data.

Overlapping & z-index: Intentional overlapping is allowed and encouraged for decorative layers (box, path, line) placed behind or over content. Z-index rule: the lower an element appears in the elements array, the lower its z-index (renders behind later elements). To layer intentionally, place background elements earlier in the array and assign them a lower zIndex value (e.g. zIndex: 0), and place foreground elements later with a higher zIndex (e.g. zIndex: 1). Any element with a non-zero zIndex is treated as an intentional overlay and will not be moved by the layout engine.

Schema capabilities:
${schemaGuidance}

LLM block contract (authoritative JSON):
${llmManifestJson}

Organization context:
${context}

Required compliance fields (${region}), all must have elements with these bindings: ${requiredList}.

Style: ${style} (${this.getStyleDescription(style)}). Include logo: ${includeLogo ? "Yes" : "No"}. Table itemsBinding="items". Currency: ${currency}. For calculated table columns add calc (e.g. "=quantity * unitPrice"). For calculated totals use mode "formula" and formula (e.g. "=SUM(items[*].total)" or subtotal+vat).

Product table config: Generate productTableConfig mapping table columns to product fields (name, description, price, currency, sku, etc.). Items: ${formatProductFieldsForAI()}. Use itemsBinding "items", columnMappings from your table columns, defaultCurrency "${currency}", autoQuantity false.

${options?.customPrompt ? `Additional instructions: ${options.customPrompt}` : ""}`;
  }

  private getStyleDescription(style: string): string {
    const descriptions: Record<string, string> = {
      modern: "Clean, contemporary design with ample whitespace and modern typography",
      classic: "Traditional business invoice style with clear sections and borders",
      minimal: "Minimalist design with focus on content and simplicity",
      professional: "Corporate-style invoice with structured layout and formal appearance",
    };
    return descriptions[style] || descriptions.modern;
  }

  /**
   * Validate all elements are within canvas boundaries
   */
  private validateCanvasBounds(elements: TemplateElement[]): { valid: boolean; errors: string[] } {
    const CANVAS_WIDTH = 794;
    const CANVAS_HEIGHT = 1123;
    const errors: string[] = [];
    
    for (const el of elements) {
      if (el.x < 0) {
        errors.push(`Element ${el.id} (${el.type}): x=${el.x} is negative`);
      }
      if (el.y < 0) {
        errors.push(`Element ${el.id} (${el.type}): y=${el.y} is negative`);
      }
      if (el.x + el.width > CANVAS_WIDTH) {
        errors.push(`Element ${el.id} (${el.type}): x + width = ${el.x + el.width} exceeds canvas width ${CANVAS_WIDTH}`);
      }
      if (el.y + el.height > CANVAS_HEIGHT) {
        errors.push(`Element ${el.id} (${el.type}): y + height = ${el.y + el.height} exceeds canvas height ${CANVAS_HEIGHT}`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Clamp element position and size to fit within canvas boundaries (A4: 794x1123)
   * This is a safety net - AI should generate elements within bounds, but we enforce it here
   */
  private clampToCanvas(element: { x: number; y: number; width: number; height: number }): void {
    const CANVAS_WIDTH = 794;
    const CANVAS_HEIGHT = 1123;
    
    // Clamp position to valid range
    element.x = Math.max(0, Math.min(element.x, CANVAS_WIDTH - 20));
    element.y = Math.max(0, Math.min(element.y, CANVAS_HEIGHT - 20));
    
    // Clamp width to ensure element fits within canvas
    const maxWidth = CANVAS_WIDTH - element.x;
    element.width = Math.max(20, Math.min(element.width, maxWidth));
    
    // Clamp height to ensure element fits within canvas
    const maxHeight = CANVAS_HEIGHT - element.y;
    element.height = Math.max(20, Math.min(element.height, maxHeight));
    
    // Final validation: ensure x + width and y + height are within bounds
    if (element.x + element.width > CANVAS_WIDTH) {
      element.width = CANVAS_WIDTH - element.x;
    }
    if (element.y + element.height > CANVAS_HEIGHT) {
      element.height = CANVAS_HEIGHT - element.y;
    }
  }

  /**
   * Enrich generated elements with proper defaults and ensure all required fields are present
   */
  private enrichElements(
    elements: Array<{
      id: string;
      type: "text" | "image" | "table" | "box" | "line" | "input" | "currency" | "icon";
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
      iconName?: string;
      color?: string;
    }>,
    requiredFields: Array<{ binding: string; label: string; format?: string }>,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    organization: Organization
  ): TemplateElement[] {
    // Determine currency based on region if not set in org settings
    const regionCurrencyMap: Record<"US" | "EU" | "CA" | "AU" | "UK", string> = {
      US: "USD",
      EU: "EUR",
      CA: "CAD",
      AU: "AUD",
      UK: "GBP",
    };
    const currency = organization.settings?.defaultCurrency || regionCurrencyMap[region] || "USD";
    
    // Store currency for use in createElementForBinding
    this.currentCurrency = currency;
    this.currentRegion = region;
    const enriched: TemplateElement[] = [];
    const existingBindings = new Set<string>();
    
    // Process generated elements
    for (const el of elements) {
      // Clamp to canvas before normalizing
      this.clampToCanvas(el);
      
      const element = this.normalizeElement(el, region, currency);
      if (element) {
        // Double-check canvas boundaries after normalization
        this.clampToCanvas(element);
        
        enriched.push(element);
        // Track bindings
        if (element.type === "text" || element.type === "input" || element.type === "currency") {
          if (element.binding) existingBindings.add(element.binding);
        } else if (element.type === "table" && element.itemsBinding) {
          existingBindings.add(element.itemsBinding);
        }
      }
    }
    
    // Add missing required fields - ensure ALL are present
    const missingFields = requiredFields.filter(f => !existingBindings.has(f.binding));
    let currentY = enriched.length > 0 
      ? Math.max(...enriched.map(el => el.y + el.height)) + 30
      : 100;
    
    for (const field of missingFields) {
      const element = this.createElementForBinding(field, currentY, region, currency);
      if (element) {
        // Ensure new elements are within canvas
        this.clampToCanvas(element);
        enriched.push(element);
        currentY = element.y + element.height + 30;
        // Prevent going beyond canvas
        if (currentY > 1100) {
          currentY = 100; // Reset to top if we've gone too far
        }
      }
    }
    
    // Validate canvas boundaries
    const boundsValidation = this.validateCanvasBounds(enriched);
    if (!boundsValidation.valid) {
      logger.warn("Canvas boundary violations detected, clamping elements", {
        errors: boundsValidation.errors,
        elementCount: enriched.length,
      });
      // Clamp all elements to ensure they fit
      enriched.forEach(el => this.clampToCanvas(el));
    }
    
    // Final validation - log if any are still missing
    const finalBindings = new Set(
      enriched.flatMap(el => {
        const bindings: string[] = [];
        if (el.type === "text" || el.type === "input" || el.type === "currency") {
          if (el.binding) bindings.push(el.binding);
        } else if (el.type === "table" && el.itemsBinding) {
          bindings.push(el.itemsBinding);
        }
        return bindings;
      })
    );
    
    const stillMissing = requiredFields.filter(f => !finalBindings.has(f.binding));
    if (stillMissing.length > 0) {
      logger.warn("Some required fields could not be added automatically", {
        missing: stillMissing.map(f => f.binding),
      });
    }
    
    return enriched;
  }

  /**
   * Normalize an AI-generated element to proper TemplateElement format
   */
  private normalizeElement(
    el: any,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    currency: string
  ): TemplateElement | null {
    const base = {
      id: el.id || `el-${Date.now()}-${Math.random()}`,
      x: Math.max(0, el.x || 40),
      y: Math.max(0, el.y || 40),
      width: Math.max(20, el.width || 200),
      height: Math.max(20, el.height || 40),
      rotation: el.rotation || 0,
      zIndex: el.zIndex || 1,
      visible: el.visible !== false,
    };

    if (el.type === "text") {
      return {
        ...base,
        type: "text",
        text: el.text || "",
        binding: el.binding,
        opacity: 1,
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
      };
    }

    if (el.type === "image") {
      return {
        ...base,
        type: "image",
        src: el.src || "",
        objectFit: "contain",
        alt: el.alt,
      };
    }

    if (el.type === "table") {
      // Preserve calc formulas from AI-generated columns
      const normalizedColumns = el.columns 
        ? el.columns.map((col: any) => ({
            ...col,
            // Preserve calc if it exists
            ...(col.calc ? { calc: col.calc } : {}),
          }))
        : undefined;
      
      return {
        ...base,
        type: "table",
        rowHeight: 28,
        headerHeight: 28,
        stripe: true,
        columns: normalizedColumns || [
          {
            id: `col-${Date.now()}-1`,
            header: "Description",
            width: "44%",
            align: "left",
            type: "text",
            binding: "description",
            format: { kind: "none" },
            showTotal: false,
          },
          {
            id: `col-${Date.now()}-2`,
            header: "Quantity",
            width: "16%",
            align: "right",
            type: "number",
            binding: "quantity",
            format: { kind: "none" },
            showTotal: false,
          },
          {
            id: `col-${Date.now()}-3`,
            header: "Price",
            width: "20%",
            align: "right",
            type: "currency",
            binding: "unitPrice",
            currency: el.currency || currency,
            format: { kind: "currency", currency: el.currency || currency },
            showTotal: false,
          },
          {
            id: `col-${Date.now()}-4`,
            header: "Total",
            width: "20%",
            align: "right",
            type: "currency",
            binding: "total",
            currency: el.currency || currency,
            format: { kind: "currency", currency: el.currency || currency },
            showTotal: false,
          },
        ],
        designRows: [],
        itemsBinding: el.itemsBinding || "items",
      };
    }

    if (el.type === "currency") {
      // Preserve formula if AI provided it, otherwise determine mode based on whether formula exists
      const hasFormula = el.formula && el.formula.trim() !== "";
      const mode = hasFormula ? "formula" : (el.mode || "independent");
      
      return {
        ...base,
        type: "currency",
        placeholder: el.placeholder || "",
        binding: el.binding,
        currency: el.currency || currency,
        currencyLinks: el.currencyLinks || [],
        mode: mode,
        formula: hasFormula ? el.formula : undefined,
        align: el.align || "right",
      };
    }

    if (el.type === "box") {
      return {
        ...base,
        type: "box",
        fill: el.fill || "#ffffff00",
        stroke: el.stroke || "#e5e7eb",
        strokeWidth: el.strokeWidth || 1,
        radius: el.radius || 0,
        opacity: 1,
      };
    }

    if (el.type === "line") {
      return {
        ...base,
        type: "line",
        x2: el.x2 || base.x + base.width,
        y2: el.y2 || base.y,
        stroke: el.stroke || "#e5e7eb",
        strokeWidth: el.strokeWidth || 1,
      };
    }

    if (el.type === "input") {
      return {
        ...base,
        type: "input",
        placeholder: el.placeholder || "",
        binding: el.binding,
        variant: el.binding?.includes("Date") || el.binding?.includes("date") ? "date" : "number",
        align: "left",
      };
    }

    if (el.type === "icon") {
      return {
        ...base,
        type: "icon",
        iconName: typeof el.iconName === "string" && el.iconName.trim() ? el.iconName.trim() : "file-text",
        color: typeof el.color === "string" && el.color ? el.color : "#111827",
      };
    }

    return null;
  }

  /**
   * Create an element for a required binding
   */
  private createElementForBinding(
    field: { binding: string; label: string; format?: string },
    yPosition: number,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    currency: string
  ): TemplateElement | null {
    // Handle nested object fields (e.g., seller.name, seller.address)
    // For nested fields, we create a text element that can display the value
    // The binding will be used to access nested data
    
    // Special handling for address objects - create a text element that can display formatted address
    if (field.binding.includes(".address") && field.format === "object") {
      return {
        id: `el-${Date.now()}-text-addr`,
        type: "text",
        x: 60,
        y: yPosition,
        width: 300,
        height: 60,
        rotation: 0,
        zIndex: 1,
        visible: true,
        text: field.label,
        binding: field.binding,
        opacity: 1,
        typography: {
          fontFamily: "Inter",
          fontSize: 11,
          fontWeight: "normal",
          lineHeight: 1.4,
          letterSpacing: 0,
          color: "#111827",
          align: "left",
          uppercase: false,
          lowercase: false,
        },
        format: { kind: "none" },
      };
    }
    
    if (field.binding === "items" || field.format === "array") {
      // Create table for items
      // Ensure table fits within canvas: x + width <= 794
      const tableX = 60;
      const maxTableWidth = 794 - tableX - 40; // Leave 40px right margin
      const tableWidth = Math.min(700, maxTableWidth); // Max 700px or whatever fits
      
      return {
        id: `el-${Date.now()}-table`,
        type: "table",
        x: tableX,
        y: yPosition,
        width: tableWidth,
        height: 200,
        rotation: 0,
        zIndex: 1,
        visible: true,
        rowHeight: 28,
        headerHeight: 28,
        stripe: true,
        columns: [
          {
            id: `col-${Date.now()}-1`,
            header: "Description",
            width: "44%",
            align: "left",
            type: "text",
            binding: "description",
            format: { kind: "none" },
            showTotal: false,
          },
          {
            id: `col-${Date.now()}-2`,
            header: "Quantity",
            width: "16%",
            align: "right",
            type: "number",
            binding: "quantity",
            format: { kind: "none" },
            showTotal: false,
          },
          {
            id: `col-${Date.now()}-3`,
            header: "Price",
            width: "20%",
            align: "right",
            type: "currency",
            binding: "unitPrice",
            currency: currency,
            format: { kind: "currency", currency: currency },
            showTotal: false,
          },
          {
            id: `col-${Date.now()}-4`,
            header: "Total",
            width: "20%",
            align: "right",
            type: "currency",
            binding: "total",
            currency: currency,
            format: { kind: "currency", currency: currency },
            showTotal: false,
          },
        ],
        designRows: [],
        itemsBinding: field.binding,
      };
    }

    if (field.format === "date" || field.binding.includes("Date") || field.binding.includes("date")) {
      // Create input for date
      return {
        id: `el-${Date.now()}-input`,
        type: "input",
        x: 60,
        y: yPosition,
        width: 200,
        height: 32,
        rotation: 0,
        zIndex: 1,
        visible: true,
        placeholder: field.label,
        binding: field.binding,
        variant: "date",
        align: "left",
      };
    }

    // Check if this is a monetary field - use Currency element instead of Text
    const isMonetaryField = 
      field.format === "currency" ||
      field.format === "number" ||
      field.binding.toLowerCase().includes("amount") ||
      field.binding.toLowerCase().includes("total") ||
      field.binding.toLowerCase().includes("subtotal") ||
      field.binding.toLowerCase().includes("tax") ||
      field.binding.toLowerCase().includes("vat") ||
      field.binding.toLowerCase().includes("price") ||
      field.binding.toLowerCase().includes("fee") ||
      field.binding.toLowerCase().includes("discount") ||
      field.binding.toLowerCase().includes("cost");
    
    if (isMonetaryField) {
      // Create Currency element for monetary values
      // Ensure it fits within canvas: x + width <= 794
      const currencyX = 550; // Right-aligned for totals
      const maxWidth = 794 - currencyX - 40; // Leave 40px right margin
      const currencyWidth = Math.min(200, maxWidth);
      
      // Determine if this field should have a formula based on binding name patterns
      // The AI will generate the actual formula, but we mark it as a calculated field
      const isCalculatedField = 
        field.binding.toLowerCase().includes("subtotal") ||
        field.binding.toLowerCase().includes("netamount") ||
        field.binding.toLowerCase().includes("net") ||
        field.binding.toLowerCase().includes("vattotal") ||
        field.binding.toLowerCase().includes("taxtotal") ||
        field.binding.toLowerCase().includes("vat") ||
        field.binding.toLowerCase().includes("tax") ||
        field.binding.toLowerCase() === "total" ||
        field.binding.toLowerCase().includes("grosstotal") ||
        field.binding.toLowerCase().includes("grandtotal");
      
      // For calculated fields, set mode to "formula"
      // The AI should have generated the formula in the template, but if it didn't, we'll let it be independent
      // The AI prompt now instructs it to generate formulas, so we trust the AI's output
      let mode: "independent" | "linked" | "formula" = "independent";
      let formula: string | undefined = undefined;
      
      if (isCalculatedField) {
        // Mark as formula mode - the AI should have provided the formula in the generated template
        // If the AI didn't provide a formula, the element will be independent (user can set it manually)
        mode = "formula";
        // Note: We don't hardcode formulas here anymore - the AI generates them based on actual bindings
        // The formula will be set by the AI in the generated template, or can be set manually by the user
      }
      
      return {
        id: `el-${Date.now()}-currency`,
        type: "currency",
        x: currencyX,
        y: yPosition,
        width: currencyWidth,
        height: 32,
        rotation: 0,
        zIndex: 1,
        visible: true,
        placeholder: "0.00",
        binding: field.binding,
        currency: currency,
        currencyLinks: [],
        mode: mode,
        formula: formula,
        align: "right",
      };
    }
    
    // Create text element for non-monetary fields
    // Ensure it fits within canvas: x + width <= 794
    const textX = 60;
    const maxTextWidth = 794 - textX - 40; // Leave 40px right margin
    const textWidth = Math.min(200, maxTextWidth);
    
    return {
      id: `el-${Date.now()}-text`,
      type: "text",
      x: textX,
      y: yPosition,
      width: textWidth,
      height: 40,
      rotation: 0,
      zIndex: 1,
      visible: true,
      text: field.label,
      binding: field.binding,
      opacity: 1,
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
    };
  }

  /**
   * Add missing required fields to elements array
   */
  private addMissingRequiredFields(
    elements: TemplateElement[],
    missingBindings: string[],
    requiredFields: Array<{ binding: string; label: string; format?: string }>
  ): TemplateElement[] {
    const newElements = [...elements];
    const maxY = elements.length > 0
      ? Math.max(...elements.map(el => el.y + el.height))
      : 80;

    for (const binding of missingBindings) {
      const field = requiredFields.find(f => f.binding === binding);
      if (field) {
        const element = this.createElementForBinding(field, maxY + 20, this.currentRegion, this.currentCurrency);
        if (element) {
          newElements.push(element);
        }
      }
    }

    return newElements;
  }
}

// Export singleton instance
let invoiceTemplateGenerationServiceInstance: InvoiceTemplateGenerationService | null = null;

/**
 * Get or create the invoice template generation service instance
 */
export function getInvoiceTemplateGenerationService(): InvoiceTemplateGenerationService {
  if (!invoiceTemplateGenerationServiceInstance) {
    invoiceTemplateGenerationServiceInstance = new InvoiceTemplateGenerationService();
  }
  return invoiceTemplateGenerationServiceInstance;
}
