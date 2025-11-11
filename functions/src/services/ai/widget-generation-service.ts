/**
 * Service for generating widget styling and configuration using AI
 * Creates beautiful, functional widget designs based on organization branding
 */

import { logger } from "firebase-functions";
import { AIService } from "./ai-service";
import { getAIService } from "./ai-service";
import { Organization } from "../../core/entities/organization";

export type WidgetType = "contactForm" | "invoiceRequest" | "quoteRequest";

export interface WidgetStyling {
  // Colors
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  errorColor: string;
  successColor: string;
  // Typography
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  // Spacing
  padding: string;
  gap: string;
  borderRadius: string;
  // Button styling
  buttonPadding: string;
  buttonBorderRadius: string;
  buttonFontWeight: string;
  // Modal/Container styling
  modalBackdropOpacity: string;
  modalBorderRadius: string;
  modalMaxWidth: string;
  // Shadow
  shadow: string;
}

export interface WidgetConfiguration {
  title: string;
  description?: string;
  submitButtonText: string;
  successMessage: string;
  builtInFields?: {
    name?: { enabled: boolean; required: boolean; label: string };
    email?: { enabled: boolean; required: boolean; label: string };
    phone?: { enabled: boolean; required: boolean; label: string };
    company?: { enabled: boolean; required: boolean; label: string };
    message?: { enabled: boolean; required: boolean; label: string };
  };
  customFields?: Array<{
    id: string;
    name: string;
    label: string;
    type: "text" | "email" | "tel" | "textarea" | "number" | "select" | "checkbox" | "date";
    required: boolean;
    placeholder?: string;
    options?: string[];
    validation?: { min?: number; max?: number; pattern?: string };
    order: number;
  }>;
}

export interface WidgetGenerationResult {
  styling: WidgetStyling;
  configuration: WidgetConfiguration;
}

export class WidgetGenerationService {
  private aiService: AIService;

  constructor(aiService?: AIService) {
    this.aiService = aiService || getAIService();
  }

  /**
   * Generate widget styling and configuration based on organization branding and preferences
   */
  async generateWidget(
    widgetType: WidgetType,
    organization: Organization,
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional" | "bold" | "elegant";
      context?: string;
      existingStyling?: Partial<WidgetStyling>;
    }
  ): Promise<WidgetGenerationResult> {
    try {
      // Build organization context
      const context = this.buildOrganizationContext(organization);
      
      // Build AI prompt
      const prompt = this.buildWidgetPrompt(widgetType, context, options);
      
      // Define schema for AI response
      const schema = {
        type: "object" as const,
        properties: {
          styling: {
            type: "object" as const,
            properties: {
              primaryColor: { type: "string" as const, description: "Primary brand color (hex)" },
              secondaryColor: { type: "string" as const, description: "Secondary color (hex)" },
              backgroundColor: { type: "string" as const, description: "Background color (hex)" },
              textColor: { type: "string" as const, description: "Text color (hex)" },
              borderColor: { type: "string" as const, description: "Border color (hex)" },
              errorColor: { type: "string" as const, description: "Error color (hex)" },
              successColor: { type: "string" as const, description: "Success color (hex)" },
              fontFamily: { type: "string" as const, description: "Font family (CSS font stack)" },
              fontSize: { type: "string" as const, description: "Base font size (CSS value)" },
              fontWeight: { type: "string" as const, description: "Font weight (CSS value)" },
              padding: { type: "string" as const, description: "Padding (CSS value)" },
              gap: { type: "string" as const, description: "Gap between elements (CSS value)" },
              borderRadius: { type: "string" as const, description: "Border radius (CSS value)" },
              buttonPadding: { type: "string" as const, description: "Button padding (CSS value)" },
              buttonBorderRadius: { type: "string" as const, description: "Button border radius (CSS value)" },
              buttonFontWeight: { type: "string" as const, description: "Button font weight (CSS value)" },
              modalBackdropOpacity: { type: "string" as const, description: "Modal backdrop opacity (0-1)" },
              modalBorderRadius: { type: "string" as const, description: "Modal border radius (CSS value)" },
              modalMaxWidth: { type: "string" as const, description: "Modal max width (CSS value)" },
              shadow: { type: "string" as const, description: "Box shadow (CSS value)" },
            },
            required: [
              "primaryColor", "secondaryColor", "backgroundColor", "textColor", "borderColor",
              "errorColor", "successColor", "fontFamily", "fontSize", "fontWeight",
              "padding", "gap", "borderRadius", "buttonPadding", "buttonBorderRadius",
              "buttonFontWeight", "modalBackdropOpacity", "modalBorderRadius", "modalMaxWidth", "shadow"
            ],
          },
          configuration: {
            type: "object" as const,
            properties: {
              title: { type: "string" as const, description: "Widget title" },
              description: { type: "string" as const, description: "Widget description (optional)" },
              submitButtonText: { type: "string" as const, description: "Submit button text" },
              successMessage: { type: "string" as const, description: "Success message after submission" },
              builtInFields: {
                type: "object" as const,
                properties: {
                  name: {
                    type: "object" as const,
                    properties: {
                      enabled: { type: "boolean" as const },
                      required: { type: "boolean" as const },
                      label: { type: "string" as const },
                    },
                  },
                  email: {
                    type: "object" as const,
                    properties: {
                      enabled: { type: "boolean" as const },
                      required: { type: "boolean" as const },
                      label: { type: "string" as const },
                    },
                  },
                  phone: {
                    type: "object" as const,
                    properties: {
                      enabled: { type: "boolean" as const },
                      required: { type: "boolean" as const },
                      label: { type: "string" as const },
                    },
                  },
                  company: {
                    type: "object" as const,
                    properties: {
                      enabled: { type: "boolean" as const },
                      required: { type: "boolean" as const },
                      label: { type: "string" as const },
                    },
                  },
                  message: {
                    type: "object" as const,
                    properties: {
                      enabled: { type: "boolean" as const },
                      required: { type: "boolean" as const },
                      label: { type: "string" as const },
                    },
                  },
                },
              },
              customFields: {
                type: "array" as const,
                items: {
                  type: "object" as const,
                  properties: {
                    id: { type: "string" as const },
                    name: { type: "string" as const },
                    label: { type: "string" as const },
                    type: {
                      type: "string" as const,
                      enum: ["text", "email", "tel", "textarea", "number", "select", "checkbox", "date"],
                    },
                    required: { type: "boolean" as const },
                    placeholder: { type: "string" as const },
                    options: { type: "array" as const, items: { type: "string" as const } },
                    order: { type: "number" as const },
                  },
                  required: ["id", "name", "label", "type", "required", "order"],
                },
              },
            },
            required: ["title", "submitButtonText", "successMessage"],
          },
        },
        required: ["styling", "configuration"],
      };
      
      // Generate widget design using AI
      const result = await this.aiService.generateJSON<{
        styling: WidgetStyling;
        configuration: WidgetConfiguration;
      }>(prompt, schema, {
        temperature: 0.7,
        maxTokens: 4096,
      });
      
      // Merge with existing styling if provided
      const finalStyling: WidgetStyling = {
        ...result.styling,
        ...(options?.existingStyling || {}),
      };
      
      return {
        styling: finalStyling,
        configuration: result.configuration,
      };
    } catch (error) {
      logger.error("Failed to generate widget", {
        error: error instanceof Error ? error.message : "Unknown error",
        widgetType,
        organizationId: organization.id,
      });
      throw new Error(
        `Failed to generate widget: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Build organization context for AI
   */
  private buildOrganizationContext(organization: Organization): string {
    const parts: string[] = [];
    
    if (organization.name) {
      parts.push(`Organization: ${organization.name}`);
    }
    
    if (organization.description) {
      parts.push(`Description: ${organization.description}`);
    }
    
    if (organization.settings?.brandColors) {
      const colors = organization.settings.brandColors;
      parts.push(`Brand Colors:`);
      if (colors.primary) parts.push(`  Primary: ${colors.primary}`);
      if (colors.secondary) parts.push(`  Secondary: ${colors.secondary}`);
      if (colors.accent) parts.push(`  Accent: ${colors.accent}`);
    }
    
    if (organization.settings?.address) {
      const addr = organization.settings.address;
      const addressParts = [
        addr.street,
        addr.city,
        addr.state,
        addr.zipCode,
        addr.country,
      ].filter(Boolean);
      if (addressParts.length > 0) {
        parts.push(`Address: ${addressParts.join(", ")}`);
      }
    }
    
    if (organization.settings?.branding?.companyName) {
      parts.push(`Company Name: ${organization.settings.branding.companyName}`);
    }
    
    return parts.join("\n");
  }

  /**
   * Build AI prompt for widget generation
   */
  private buildWidgetPrompt(
    widgetType: WidgetType,
    context: string,
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional" | "bold" | "elegant";
      context?: string;
      existingStyling?: Partial<WidgetStyling>;
    }
  ): string {
    const style = options?.style || "modern";
    const widgetTypeName = widgetType === "contactForm" 
      ? "Contact Form" 
      : widgetType === "invoiceRequest"
      ? "Invoice Request"
      : "Quote Request";
    
    const styleDescription = this.getStyleDescription(style);
    
    return `You are a professional UI/UX designer specializing in widget design. Create a beautiful, functional, and conversion-optimized ${widgetTypeName} widget.

Organization Context:
${context}

${options?.context ? `Additional Context:\n${options.context}\n` : ""}

Design Requirements:
- Style: ${style} (${styleDescription})
- Widget Type: ${widgetTypeName}
- Must be modern, accessible, and user-friendly
- Colors should harmonize with the organization's brand colors
- Typography should be readable and professional
- Spacing should create visual hierarchy and breathing room
- Buttons should be prominent and action-oriented
- Form fields should be clearly labeled and easy to use

Styling Guidelines:
- Use the organization's primary color for buttons and accents
- Use the secondary color for borders and subtle elements
- Ensure sufficient contrast for accessibility (WCAG AA minimum)
- Use modern CSS values (e.g., "16px" not "1em", "0.5" not "50%")
- Shadows should be subtle and add depth
- Border radius should be consistent (typically 8-12px)
- Font family should be a modern, web-safe stack

Configuration Guidelines:
- Title should be clear and action-oriented
- Description should be concise and helpful (optional)
- Submit button text should be action-oriented (e.g., "Send Message", "Request Invoice")
- Success message should be friendly and confirm the action
- Built-in fields should be enabled based on widget type:
  * Contact Form: name, email, message (required), phone, company (optional)
  * Invoice Request: name, email (required), company, phone (optional)
  * Quote Request: name, email, company (required), phone, message (optional)
- Field labels should be clear and concise
- Only suggest custom fields if they add significant value

Generate a complete widget design with styling and configuration that matches the organization's brand and the specified style.`;
  }

  /**
   * Get style description
   */
  private getStyleDescription(style: string): string {
    const descriptions: Record<string, string> = {
      modern: "Clean lines, contemporary colors, subtle shadows, rounded corners",
      classic: "Traditional design, conservative colors, minimal shadows, standard corners",
      minimal: "Minimalist approach, lots of white space, simple colors, clean typography",
      professional: "Business-focused, trustworthy colors, balanced spacing, corporate feel",
      bold: "Vibrant colors, strong contrasts, prominent buttons, eye-catching design",
      elegant: "Sophisticated palette, refined typography, subtle details, premium feel",
    };
    return descriptions[style] || descriptions.modern;
  }
}

// Export singleton instance
let widgetGenerationServiceInstance: WidgetGenerationService | null = null;

/**
 * Get or create the widget generation service instance
 */
export function getWidgetGenerationService(): WidgetGenerationService {
  if (!widgetGenerationServiceInstance) {
    widgetGenerationServiceInstance = new WidgetGenerationService();
  }
  return widgetGenerationServiceInstance;
}


