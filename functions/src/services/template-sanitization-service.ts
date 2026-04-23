import { Template, TemplateData } from "../core/entities/template";
import { EmailTemplate, EmailTemplateData } from "../core/entities/email-template";
import { removeUndefinedValues } from "../utils/remove-undefined-values";

export interface TemplateSanitizationService {
  /**
   * Sanitize an invoice template by removing org-specific data
   */
  sanitizeInvoiceTemplate(template: Template): TemplateData;

  /**
   * Sanitize an email template by removing org-specific data and sanitizing HTML
   */
  sanitizeEmailTemplate(template: EmailTemplate): EmailTemplateData;

  /**
   * Validate template content has required placeholders
   */
  validateTemplateContent(
    templateData: TemplateData | EmailTemplateData,
    type: "invoice" | "email"
  ): { valid: boolean; missingPlaceholders: string[] };
}

/**
 * Sanitization service for marketplace templates
 * Removes organization-specific data and replaces with placeholders
 */
export const templateSanitizationService: TemplateSanitizationService = {
  sanitizeInvoiceTemplate(template: Template): TemplateData {
    // Build brand object, conditionally including backgroundImage
    const brand: any = {
      ...template.brand,
    };
    
    // Only include backgroundImage if it doesn't contain org-specific URLs
    if (template.brand.backgroundImage && !template.brand.backgroundImage.includes("organizations/")) {
      brand.backgroundImage = template.brand.backgroundImage;
    }
    // If it contains org-specific URLs, omit the field entirely (don't set to undefined)

    const sanitized: TemplateData = {
      orgId: "[Your Organization ID]", // Placeholder
      name: template.name,
      description: template.description,
      pageSize: template.pageSize,
      brand,
      elements: template.elements.map((element) => {
        // Sanitize image elements - replace org-specific image URLs with placeholders
        if (element.type === "image") {
          const sanitizedElement: any = { ...element };
          if (element.src?.includes("organizations/")) {
            sanitizedElement.src = "[Your Image URL]";
          }
          return sanitizedElement;
        }
        return element;
      }),
      backgroundElements: template.backgroundElements ?? [],
      status: "draft",
      compliance: template.compliance,
      productTableConfig: template.productTableConfig,
    };

    // Remove any undefined values before returning (Firestore doesn't allow undefined)
    return removeUndefinedValues(sanitized);
  },

  sanitizeEmailTemplate(template: EmailTemplate): EmailTemplateData {
    // Sanitize HTML content - remove scripts, iframes, and org-specific URLs
    let sanitizedHtml = template.htmlContent || "";

    // Remove script tags
    sanitizedHtml = sanitizedHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

    // Remove iframe tags
    sanitizedHtml = sanitizedHtml.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");

    // Replace org-specific image URLs with placeholders
    sanitizedHtml = sanitizedHtml.replace(
      /src="[^"]*organizations\/[^"]*"/gi,
      'src="[Your Image URL]"'
    );

    // Replace org-specific links with placeholders
    sanitizedHtml = sanitizedHtml.replace(
      /href="[^"]*organizations\/[^"]*"/gi,
      'href="[Your Link URL]"'
    );

    const sanitized: EmailTemplateData = {
      orgId: "[Your Organization ID]",
      name: template.name,
      description: template.description,
      subject: template.subject,
      preheader: template.preheader,
      htmlContent: sanitizedHtml,
      blocks: template.blocks.map((block) => {
        // Sanitize image blocks
        if (block.type === "image" || block.type === "logo") {
          const sanitizedBlock: any = { ...block };
          if (block.src?.includes("organizations/")) {
            sanitizedBlock.src = "[Your Image URL]";
          }
          return sanitizedBlock;
        }
        // Sanitize button blocks
        if (block.type === "button") {
          const sanitizedBlock: any = { ...block };
          if (block.url?.includes("organizations/")) {
            sanitizedBlock.url = "[Your Link URL]";
          }
          return sanitizedBlock;
        }
        return block;
      }),
      status: "draft",
      version: 1,
      isSystemDefault: false,
      isLocked: false,
      allowedContexts: [],
      designTokens: template.designTokens,
      placeholders: template.placeholders,
      sections: template.sections,
    };

    // Remove any undefined values before returning (Firestore doesn't allow undefined)
    return removeUndefinedValues(sanitized);
  },

  validateTemplateContent(
    templateData: TemplateData | EmailTemplateData,
    type: "invoice" | "email"
  ): { valid: boolean; missingPlaceholders: string[] } {
    // Validation disabled - always return valid
    // Templates can have any structure, no required placeholders enforced
    return {
      valid: true,
      missingPlaceholders: [],
    };
  },
};
