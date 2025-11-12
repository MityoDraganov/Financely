/**
 * Service for generating consent banner styling using AI
 * Creates beautiful, GDPR-compliant consent banners based on organization branding
 */

import { logger } from "firebase-functions";
import { AIService } from "./ai-service";
import { getAIService } from "./ai-service";
import { Organization } from "../../core/entities/organization";
import { ConsentBannerStyling } from "../../core/entities/analytics-config";

export interface ConsentBannerGenerationResult {
  styling: ConsentBannerStyling;
}

export class ConsentBannerGenerationService {
  private aiService: AIService;

  constructor(aiService?: AIService) {
    this.aiService = aiService || getAIService();
  }

  /**
   * Generate consent banner styling based on organization branding and preferences
   */
  async generateConsentBanner(
    organization: Organization,
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional" | "bold" | "elegant";
      context?: string;
      existingStyling?: Partial<ConsentBannerStyling>;
    }
  ): Promise<ConsentBannerGenerationResult> {
    try {
      // Build organization context
      const context = this.buildOrganizationContext(organization);
      
      // Build AI prompt
      const prompt = this.buildConsentBannerPrompt(context, options);
      
      // Define schema for AI response
      const schema = {
        type: "object" as const,
        properties: {
          styling: {
            type: "object" as const,
            properties: {
              backgroundColor: { type: "string" as const },
              textColor: { type: "string" as const },
              buttonBackgroundColor: { type: "string" as const },
              buttonTextColor: { type: "string" as const },
              linkColor: { type: "string" as const },
              borderColor: { type: "string" as const },
              borderRadius: { type: "string" as const },
              padding: { type: "string" as const },
              fontSize: { type: "string" as const },
              fontFamily: { type: "string" as const },
              fontWeight: { type: "string" as const },
              shadow: { type: "string" as const },
              position: { 
                type: "string" as const,
                enum: ["bottom", "top", "center"],
              },
              maxWidth: { type: "string" as const },
              acceptButtonText: { type: "string" as const },
              rejectButtonText: { type: "string" as const },
              message: { type: "string" as const },
              showRejectButton: { type: "boolean" as const },
            },
            required: [
              "backgroundColor",
              "textColor",
              "buttonBackgroundColor",
              "buttonTextColor",
              "linkColor",
              "borderColor",
              "borderRadius",
              "padding",
              "fontSize",
              "fontFamily",
              "fontWeight",
              "shadow",
              "position",
              "maxWidth",
              "acceptButtonText",
              "rejectButtonText",
              "message",
              "showRejectButton",
            ],
          },
        },
        required: ["styling"],
      };
      
      // Generate consent banner design using AI
      const result = await this.aiService.generateJSON<{
        styling: ConsentBannerStyling;
      }>(prompt, schema, {
        temperature: 0.7,
        maxTokens: 2048,
      });
      
      // Merge with existing styling if provided
      const finalStyling: ConsentBannerStyling = {
        ...result.styling,
        ...(options?.existingStyling || {}),
      };
      
      return {
        styling: finalStyling,
      };
    } catch (error) {
      logger.error("Failed to generate consent banner", {
        error: error instanceof Error ? error.message : String(error),
        organizationId: organization.id,
      });
      throw error;
    }
  }

  /**
   * Build organization context for AI prompt
   */
  private buildOrganizationContext(organization: Organization): string {
    const parts: string[] = [];
    
    if (organization.name) {
      parts.push(`Organization: ${organization.name}`);
    }
    
    if (organization.settings?.branding?.companyName) {
      parts.push(`Company Name: ${organization.settings.branding.companyName}`);
    }
    
    if (organization.settings?.brandColors) {
      const colors = organization.settings.brandColors;
      if (colors.primary) {
        parts.push(`Primary Brand Color: ${colors.primary}`);
      }
      if (colors.secondary) {
        parts.push(`Secondary Brand Color: ${colors.secondary}`);
      }
      if (colors.accent) {
        parts.push(`Accent Brand Color: ${colors.accent}`);
      }
    }
    
    return parts.join("\n");
  }

  /**
   * Build AI prompt for consent banner generation
   */
  private buildConsentBannerPrompt(
    context: string,
    options?: {
      style?: "modern" | "classic" | "minimal" | "professional" | "bold" | "elegant";
      context?: string;
    }
  ): string {
    const style = options?.style || "modern";
    const additionalContext = options?.context || "";
    
    return `You are a UI/UX designer specializing in GDPR-compliant consent banners. Generate a beautiful, professional consent banner design that matches the organization's branding.

Organization Context:
${context}

${additionalContext ? `Additional Requirements:\n${additionalContext}\n` : ""}

Style Preference: ${style}

Requirements:
1. The banner must be GDPR-compliant and clearly communicate cookie/analytics usage
2. Colors should match the organization's brand colors (use primary color for buttons, ensure good contrast)
3. The design should be ${style} in style
4. Ensure excellent readability and accessibility (WCAG AA compliant)
5. The banner should be non-intrusive but visible
6. Include appropriate spacing, shadows, and modern design elements
7. Button text should be clear and action-oriented
8. Message should be concise but informative

Generate a complete consent banner styling configuration with:
- Background color (should contrast well with text)
- Text color (high contrast for readability)
- Button colors (use brand primary color, ensure good contrast)
- Link color (should be distinct from regular text)
- Border and spacing (modern, clean appearance)
- Typography (readable, professional font)
- Shadow (subtle depth for modern look)
- Position (bottom is recommended for non-intrusive UX)
- Button text (clear, GDPR-appropriate)
- Message (concise, informative about analytics/cookies)

Return the styling configuration as JSON matching the schema.`;
  }
}

// Singleton instance
let consentBannerGenerationServiceInstance: ConsentBannerGenerationService | null = null;

/**
 * Get or create the consent banner generation service instance
 */
export function getConsentBannerGenerationService(): ConsentBannerGenerationService {
  if (!consentBannerGenerationServiceInstance) {
    consentBannerGenerationServiceInstance = new ConsentBannerGenerationService();
  }
  return consentBannerGenerationServiceInstance;
}

