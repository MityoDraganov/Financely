import { logger } from "firebase-functions";
import { AIService } from "./ai-service";
import { getAIService } from "./ai-service";
import { TemplateData, TemplateElement } from "../../core/entities/template";
import { Organization } from "../../core/entities/organization";
import { COMPLIANCE_SCHEMAS } from "../../core/entities/invoice-compliance";
import { validateTemplateCompliance } from "../../utils/invoice-compliance";

/**
 * Service for generating invoice templates using AI
 * Creates beautiful, functional, and fully compliant invoice templates
 */
export class InvoiceTemplateGenerationService {
  private aiService: AIService;

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
    const prompt = this.buildTemplatePrompt(context, requiredFields, region, options);
    
    // Define the expected JSON schema for template data
    const schema = {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Template name" },
        description: { type: "string" as const, description: "Template description" },
        pageSize: { type: "string" as const, enum: ["A4", "Letter"], description: "Page size" },
        brand: {
          type: "object" as const,
          properties: {
            fonts: { type: "array" as const, items: { type: "string" as const } },
            colors: {
              type: "object" as const,
              properties: {
                primary: { type: "string" as const },
                secondary: { type: "string" as const },
                accent: { type: "string" as const },
              },
            },
            margins: {
              type: "object" as const,
              properties: {
                top: { type: "number" as const },
                right: { type: "number" as const },
                bottom: { type: "number" as const },
                left: { type: "number" as const },
              },
            },
          },
        },
        elements: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              id: { type: "string" as const },
              type: { type: "string" as const, enum: ["text", "image", "table", "box", "line", "input", "currency"] },
              x: { type: "number" as const },
              y: { type: "number" as const },
              width: { type: "number" as const },
              height: { type: "number" as const },
              binding: { type: "string" as const },
              text: { type: "string" as const },
              typography: { type: "object" as const },
              format: { type: "object" as const },
              itemsBinding: { type: "string" as const },
              columns: { type: "array" as const },
            },
          },
        },
      },
      required: ["name", "pageSize", "brand", "elements"],
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
        }>;
      }>(prompt, schema, {
        temperature: 0.7,
        maxTokens: 16384, // Large token limit for complex template structures
      });
      
      // Validate and enrich the generated template
      const template: TemplateData = {
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
          margins: result.brand?.margins || { top: 40, right: 40, bottom: 40, left: 40 },
        },
        elements: this.enrichElements(result.elements, requiredFields, region),
        status: "draft",
        compliance: {
          region,
          requiredFields: requiredFields.map(f => f.binding),
          autoFooter: true,
          complianceValidated: false,
        },
      };
      
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
    
    if (orgData.settings?.defaultCurrency) {
      parts.push(`Default Currency: ${orgData.settings.defaultCurrency}`);
    }
    
    parts.push(`\nCompliance Region: ${region}`);
    parts.push(`This invoice template must comply with ${region} invoice requirements.`);
    
    return parts.join("\n");
  }

  /**
   * Build the prompt for AI template generation
   */
  private buildTemplatePrompt(
    context: string,
    requiredFields: Array<{ binding: string; label: string; description?: string; format?: string }>,
    region: "US" | "EU" | "CA" | "AU" | "UK",
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional";
      includeLogo?: boolean;
      customPrompt?: string;
    }
  ): string {
    const style = options?.style || "modern";
    const includeLogo = options?.includeLogo ?? true;
    
    const requiredFieldsList = requiredFields.map((f, idx) => 
      `${idx + 1}. ${f.binding} (${f.label})${f.description ? `: ${f.description}` : ""}${f.format ? ` [Format: ${f.format}]` : ""}`
    ).join("\n");
    
    const requiredFieldsSummary = requiredFields.map(f => f.binding).join(", ");
    
    return `You are a professional invoice template designer. Create a beautiful, functional, and fully compliant invoice template.

Organization Context:
${context}

CRITICAL: Required Compliance Fields (ALL MUST be included - this is legally mandatory):
${requiredFieldsList}

Required Field Bindings Summary: ${requiredFieldsSummary}

IMPORTANT: You MUST create elements for EVERY single required field listed above. Missing any field will result in non-compliance. Double-check your output includes all ${requiredFields.length} required fields.

Design Requirements:
- Style: ${style} (${this.getStyleDescription(style)})
- Page size: A4 (794x1123 pixels) - CANVAS DIMENSIONS ARE FIXED: width=794px, height=1123px
- Include organization logo: ${includeLogo ? "Yes" : "No"}
- All required compliance fields must be present with correct bindings
- Layout should be professional and easy to read
- Use appropriate typography hierarchy
- Include proper spacing and alignment
- Table for line items must use binding "items" for itemsBinding

🚨 CRITICAL: Currency Element Usage (MANDATORY):
- ALL monetary values MUST use Currency elements, NOT Input elements
- Use Currency elements for: total, subtotal, taxTotal, vatTotal, grandTotal, amount, price, fee, discount, etc.
- NEVER use Input elements for monetary amounts - this is incorrect
- Currency elements automatically format with currency symbol and proper locale formatting
- Set currency code (e.g., "USD", "EUR", "GBP") from organization context
- For table price columns (unitPrice, lineTotal, etc.), set column type to "currency" and specify currency code

- Date fields should use Input elements with variant="date" or Text elements with date formatting

Template Structure:
1. Header section (top): Logo (if included), organization name, invoice title
2. Seller/Supplier section: Name, address, contact info, VAT ID (if required)
3. Customer section: Name, address, VAT ID (if required)
4. Invoice details: Invoice number, date, due date, currency
5. Items table: Description, quantity, unit price, total (with proper bindings)
6. Totals section: Subtotal, tax/VAT, total
7. Footer: Payment terms, notes, compliance footer (if auto-footer enabled)

Element Guidelines:
- Text elements: Use for labels, headers, static text. Set appropriate typography (font size, weight, color)
- Table elements: Use for line items. Must have itemsBinding="items" and columns with bindings like "description", "quantity", "unitPrice", "total"
  * 🚨 MANDATORY: Table columns with price bindings (unitPrice, lineTotal, total, etc.) MUST have type="currency"
  * When creating price columns in tables, ALWAYS set column type to "currency" (NOT "number" or "text")
  * Specify the currency code in the column (e.g., currency: "USD", "EUR", "GBP") from organization context
  * Currency columns automatically format with currency symbol and proper locale formatting
  * Currency columns support field linking for automatic conversion between currencies
  * Example: { id: "col-price", header: "Price", type: "currency", currency: "USD", binding: "unitPrice", width: 100, align: "right" }
- Input elements: Use ONLY for date fields (variant="date") or basic text inputs. NEVER use Input elements for monetary amounts.
- 🚨 Currency elements: MANDATORY for ALL monetary values (totals, subtotals, taxTotal, vatTotal, grandTotal, amount, price, fee, discount, etc.)
  * Automatically formats with currency symbol and proper locale formatting
  * Set currency code (e.g., "USD", "EUR", "GBP") from organization context
  * Set binding to the monetary field (e.g., binding: "total", binding: "subtotal")
  * Supports field linking for automatic conversion between currencies
  * Example: { type: "currency", currency: "USD", binding: "total", x: 550, y: 650, width: 200, height: 32 }
- Box elements: Use for sections/containers with borders
- Line elements: Use for separators

Binding Requirements:
- All required fields from the compliance schema must have corresponding elements with the correct binding
- Table itemsBinding must be "items"
- Use dot notation for nested data (e.g., "seller.name", "seller.address.street")
- Currency fields should have format: { kind: "currency", currency: "USD" }
- Date fields should have format: { kind: "date", dateFormat: "YYYY-MM-DD" }

🚨 CRITICAL: Canvas Boundaries (A4 = 794x1123 pixels) - ABSOLUTE REQUIREMENT:
- Canvas dimensions are FIXED: width = 794px, height = 1123px
- ALL elements MUST satisfy these constraints:
  * x >= 0 AND x + width <= 794 (element must fit horizontally)
  * y >= 0 AND y + height <= 1123 (element must fit vertically)
- BEFORE setting any element position, CALCULATE: x + width <= 794 and y + height <= 1123
- If an element would overflow, REDUCE its width/height or move it to a valid position
- NEVER create elements that violate these boundaries - they will cause rendering errors

Recommended Safe Zones (with margins):
- Header section: x: 40-60, y: 40-100, max width: 714px (794 - 80px margins), max y: 150
- Seller section: x: 40-60, y: 150-250, max width: 350px
- Customer section: x: 40-60 or 400-450, y: 150-250, max width: 350px
- Invoice details: x: 400-450, y: 40-150, max width: 344px (794 - 450)
- Items table: x: 40-60, y: 350-450, width: 700-714px MAX (794 - 80px margins), ensure x + width <= 794
- Totals section: x: 500-550, y: 600-700, max width: 244px (794 - 550), ensure x + width <= 794
- Footer: x: 40-60, y: 950-1050, max width: 714px, ensure y + height <= 1123

VALIDATION CHECKLIST for each element:
1. Is x >= 0? ✓
2. Is y >= 0? ✓
3. Is x + width <= 794? ✓ (CRITICAL - check this!)
4. Is y + height <= 1123? ✓ (CRITICAL - check this!)
5. If any check fails, ADJUST the element before including it in output

Layout Guidelines:
- Use consistent margins: 40-60px from edges
- Vertical spacing: 20-40px between sections, 10-15px between related elements
- Two-column layout for header: logo/org info (left), invoice details (right)
- Table width calculation: MAX width = 794 - x - 40 (leave 40px right margin). If x=40, max width = 714px. ALWAYS verify: x + width <= 794
- Ensure no overlapping elements - check x, y, width, height carefully
- Group related elements visually (use boxes or consistent spacing)
- Align elements to a grid for professional appearance

🚨 ELEMENT POSITIONING VALIDATION (MANDATORY):
Before including ANY element in the output, verify:
1. Calculate: element.x + element.width. This MUST be <= 794
2. Calculate: element.y + element.height. This MUST be <= 1123
3. If either calculation fails, REDUCE width/height or adjust position
4. For tables: table.x + table.width <= 794 (critical for wide tables)
5. For text elements: text.x + text.width <= 794 (text can overflow if too wide)
6. Double-check all numeric values are within bounds before finalizing

Design Quality:
- Avoid random or sloppy positioning - every element should have a clear purpose
- Use consistent alignment (left-align text blocks, right-align numbers)
- Create visual hierarchy with font sizes (headers: 18-24px, body: 11-14px, labels: 10-12px)
- Use appropriate colors from organization brand colors provided in context
- Ensure text is readable (sufficient contrast, appropriate font sizes)
- Box elements should have subtle borders (strokeWidth: 1-2px) and optional background fills
- Line elements should be used sparingly for section separators

CRITICAL: Data Accuracy Rules
- Use ONLY the organization data provided in the context (name, address, email, phone, brand colors, currency)
- DO NOT invent or hallucinate organization information that is not in the context
- If organization data is missing (e.g., no address), use empty strings or omit those fields - DO NOT make up addresses, phone numbers, or other details
- Use the exact brand colors from the context, do not invent new colors
- Use the exact currency from the context, do not assume a currency

${options?.customPrompt ? `\n\nADDITIONAL USER INSTRUCTIONS:\n${options.customPrompt}\n\nPlease incorporate these specific requirements into the template design while maintaining compliance and professional appearance.` : ""}

FINAL VALIDATION BEFORE OUTPUT:
1. ✅ All monetary fields (total, subtotal, taxTotal, etc.) use Currency elements (NOT Input)
2. ✅ All table price columns have type="currency" with currency code specified
3. ✅ Every element satisfies: x >= 0, y >= 0, x + width <= 794, y + height <= 1123
4. ✅ No elements overflow canvas boundaries
5. ✅ All required compliance fields have elements with correct bindings

Generate a complete template JSON with all elements properly configured, positioned within canvas boundaries, and styled professionally. Ensure all required compliance fields are included with correct bindings. Use only real data from the organization context provided.

REMEMBER: Currency elements for ALL money values. Canvas boundaries are ABSOLUTE - verify every element position.`;
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
    }>,
    requiredFields: Array<{ binding: string; label: string; format?: string }>,
    region: "US" | "EU" | "CA" | "AU" | "UK"
  ): TemplateElement[] {
    const enriched: TemplateElement[] = [];
    const existingBindings = new Set<string>();
    
    // Process generated elements
    for (const el of elements) {
      // Clamp to canvas before normalizing
      this.clampToCanvas(el);
      
      const element = this.normalizeElement(el, region);
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
      const element = this.createElementForBinding(field, currentY);
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
    region: "US" | "EU" | "CA" | "AU" | "UK"
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
        padding: 0,
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
      return {
        ...base,
        type: "table",
        rowHeight: 28,
        headerHeight: 28,
        stripe: true,
        columns: el.columns || [
          {
            id: `col-${Date.now()}-1`,
            header: "Description",
            width: 200,
            align: "left",
            type: "text",
            binding: "description",
            format: { kind: "none" },
          },
          {
            id: `col-${Date.now()}-2`,
            header: "Quantity",
            width: 80,
            align: "right",
            type: "number",
            binding: "quantity",
            format: { kind: "none" },
          },
          {
            id: `col-${Date.now()}-3`,
            header: "Price",
            width: 100,
            align: "right",
            type: "currency",
            binding: "unitPrice",
            currency: "USD",
            format: { kind: "currency", currency: "USD" },
          },
          {
            id: `col-${Date.now()}-4`,
            header: "Total",
            width: 100,
            align: "right",
            type: "currency",
            binding: "total",
            currency: "USD",
            format: { kind: "currency", currency: "USD" },
          },
        ],
        designRows: [],
        itemsBinding: el.itemsBinding || "items",
        totals: [],
      };
    }

    if (el.type === "currency") {
      return {
        ...base,
        type: "currency",
        placeholder: el.placeholder || "",
        binding: el.binding,
        currency: el.currency || "USD",
        currencyLinks: el.currencyLinks || [],
        mode: el.mode || "independent",
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

    return null;
  }

  /**
   * Create an element for a required binding
   */
  private createElementForBinding(
    field: { binding: string; label: string; format?: string },
    yPosition: number
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
        padding: 0,
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
            width: 200,
            align: "left",
            type: "text",
            binding: "description",
            format: { kind: "none" },
          },
          {
            id: `col-${Date.now()}-2`,
            header: "Quantity",
            width: 80,
            align: "right",
            type: "number",
            binding: "quantity",
            format: { kind: "none" },
          },
          {
            id: `col-${Date.now()}-3`,
            header: "Price",
            width: 100,
            align: "right",
            type: "number",
            binding: "unitPrice",
            format: { kind: "currency", currency: "USD" },
          },
          {
            id: `col-${Date.now()}-4`,
            header: "Total",
            width: 100,
            align: "right",
            type: "number",
            binding: "total",
            format: { kind: "currency", currency: "USD" },
          },
        ],
        designRows: [],
        itemsBinding: field.binding,
        totals: [],
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
        currency: "USD", // Will be overridden by organization currency if available
        currencyLinks: [],
        mode: "independent",
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
      padding: 0,
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
        const element = this.createElementForBinding(field, maxY + 20);
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

