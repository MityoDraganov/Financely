import { logger } from "firebase-functions";

interface GeminiConfig {
  apiKey: string;
  model?: string;
}

interface BrandContext {
  brandName: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  logoUrl?: string;
  tone: string;
  description?: string;
  brandImages?: string[];
  context?: string;
  contextImages?: string[];
  products?: Array<{ name: string; description?: string; price: number; currency: string; category?: string; images?: string[] }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        [key: string]: unknown;
      }>;
    };
    finishReason?: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
    [key: string]: unknown;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
  [key: string]: unknown;
}

export class GeminiService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiBaseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    // Use gemini-2.5-flash (stable) or gemini-2.5-pro-preview-03-25 for latest models
    // Available models: gemini-2.5-flash, gemini-2.5-flash-preview-05-20, gemini-2.5-pro-preview-03-25
    this.model = config.model || "gemini-2.5-flash";
  }

  async generateSiteHtml(brandContext: BrandContext): Promise<string> {
    const prompt = this.buildPrompt(brandContext);

    const url = `${this.apiBaseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 65536, // gemini-2.5-flash supports up to 65536 output tokens
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage = `Gemini API error: ${errorJson.error.message}`;
          }
        } catch {
          // If not JSON, use the text as is
          if (errorText) {
            errorMessage = `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`;
          }
        }
        
        logger.error("Gemini API error", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          model: this.model,
          url: url.replace(this.apiKey, "REDACTED"),
        });
        
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as GeminiResponse;

      logger.info("Gemini API response structure", {
        hasCandidates: !!data.candidates,
        candidatesLength: data.candidates?.length || 0,
        firstCandidate: data.candidates?.[0] ? {
          hasContent: !!data.candidates[0].content,
          hasParts: !!data.candidates[0].content?.parts,
          partsLength: data.candidates[0].content?.parts?.length || 0,
          firstPartType: data.candidates[0].content?.parts?.[0] ? Object.keys(data.candidates[0].content.parts[0]) : [],
        } : null,
        fullResponse: JSON.stringify(data).substring(0, 500),
      });

      if (!data.candidates || data.candidates.length === 0) {
        logger.error("Gemini API returned no candidates", {
          fullResponse: JSON.stringify(data),
        });
        throw new Error("Invalid response from Gemini API: No candidates returned");
      }

      const candidate = data.candidates[0];
      const finishReason = (candidate as any).finishReason;
      
      if (!candidate.content?.parts || candidate.content.parts.length === 0) {
        logger.error("Gemini API returned candidate with no content parts", {
          candidate: JSON.stringify(candidate),
        });
        throw new Error("Invalid response from Gemini API: No content parts in candidate");
      }

      const textPart = candidate.content.parts.find((part: any) => part.text);
      if (!textPart || !textPart.text) {
        logger.error("Gemini API returned no text content", {
          parts: candidate.content.parts,
        });
        throw new Error("Invalid response from Gemini API: No text content in parts");
      }

      // Check for finishReason after we've confirmed we have text content
      if (finishReason && finishReason !== "STOP") {
        if (finishReason === "MAX_TOKENS") {
          // MAX_TOKENS means response was truncated but we still got content
          logger.warn("Gemini API response truncated due to token limit", {
            finishReason,
            htmlLength: textPart.text.length,
          });
          // Continue with partial content - it might still be usable HTML
        } else {
          // Other finish reasons (SAFETY, etc.) mean content was blocked
          logger.error("Gemini API content blocked", {
            finishReason,
            safetyRatings: (candidate as any).safetyRatings,
          });
          throw new Error(`Gemini API content blocked: ${finishReason}`);
        }
      }

      let html = textPart.text;
      
      // If we hit MAX_TOKENS, try to complete the HTML structure
      if (finishReason === "MAX_TOKENS") {
        logger.info("Completing truncated HTML response", {
          htmlLength: html.length,
          htmlEnding: html.substring(Math.max(0, html.length - 200)),
          hasBodyClose: html.includes("</body>"),
          hasHtmlClose: html.includes("</html>"),
        });
        
        // Try to close any open tags if HTML is incomplete
        if (!html.includes("</body>") && !html.includes("</html>")) {
          // Check if we have a body tag
          if (html.includes("<body")) {
            html += "\n</body>\n</html>";
          } else {
            // If no body tag, just close html
            html += "\n</html>";
          }
        } else if (!html.includes("</html>") && html.includes("</body>")) {
          html += "\n</html>";
        }
      }

      logger.info("HTML generated successfully", {
        brandName: brandContext.brandName,
        htmlLength: html.length,
        finishReason: finishReason || "STOP",
        wasTruncated: finishReason === "MAX_TOKENS",
      });

      return this.sanitizeHtml(html);
    } catch (error) {
      logger.error("Failed to generate HTML with Gemini", {
        error: error instanceof Error ? error.message : "Unknown error",
        brandName: brandContext.brandName,
      });
      throw error;
    }
  }

  private buildPrompt(brandContext: BrandContext): string {
    const { brandName, colors, logoUrl, tone, description, brandImages, context, contextImages, products } = brandContext;

    let prompt = `Generate a complete, modern, responsive website HTML page for a brand called "${brandName}". 

Requirements:
1. Use inline CSS only (no external stylesheets)
2. Make it fully responsive (mobile-first design)
3. Use the following color palette:
   - Primary: ${colors.primary}
   - Secondary: ${colors.secondary}
   - Accent: ${colors.accent}
4. Brand tone: ${tone}`;

    if (description) {
      prompt += `\n5. Brand description: ${description}`;
    }

    if (logoUrl) {
      prompt += `\n6. Include the logo at: ${logoUrl}`;
    }

    if (brandImages && brandImages.length > 0) {
      prompt += `\n7. Include these brand images in the gallery section: ${brandImages.join(", ")}`;
    }

    prompt += `\n8. Include a hero section with brand name
9. Include sections: About, Features/Services, Contact
10. Use modern CSS (flexbox/grid, smooth transitions)
11. Include proper semantic HTML5
12. Make it visually appealing with proper spacing, typography, and visual hierarchy
13. Add subtle animations and hover effects
14. Ensure accessibility (proper alt tags, ARIA labels where needed)`;

    if (context) {
      prompt += `\n\nAdditional Context and Instructions:
${context}`;
    }

    if (contextImages && contextImages.length > 0) {
      prompt += `\n\nContext Images (use these as reference for styling and content):
${contextImages.join(", ")}`;
    }

    if (products && products.length > 0) {
      prompt += `\n\nProducts/Services to Feature:
The website should prominently feature these products/services:`;
      products.forEach((product) => {
        const productInfo = [
          `- ${product.name}`,
          product.description ? `  Description: ${product.description}` : null,
          `  Price: ${product.price} ${product.currency}`,
          product.category ? `  Category: ${product.category}` : null,
          product.images && product.images.length > 0 ? `  Images: ${product.images[0]}` : null,
        ].filter(Boolean).join("\n");
        prompt += `\n${productInfo}`;
      });
      prompt += `\n\nCreate a products/services section showcasing these items with their descriptions, prices, and images. Make it visually appealing and easy to browse.`;
    }

    prompt += `\n\nThe HTML should be complete and ready to deploy. Include:
- <!DOCTYPE html>
- <html> with lang attribute
- <head> with meta tags, title, and viewport
- <body> with all content
- All CSS inline in <style> tag or style attributes

Output ONLY the HTML code, no markdown, no explanations, just the HTML.`;

    return prompt;
  }

  private sanitizeHtml(html: string): string {
    let sanitized = html.trim();

    if (sanitized.startsWith("```html")) {
      sanitized = sanitized.replace(/```html\s*/i, "").replace(/```\s*$/, "");
    } else if (sanitized.startsWith("```")) {
      sanitized = sanitized.replace(/```\s*/i, "").replace(/```\s*$/, "");
    }

    sanitized = sanitized.trim();

    if (!sanitized.startsWith("<!DOCTYPE") && !sanitized.startsWith("<html")) {
      sanitized = `<!DOCTYPE html>\n${sanitized}`;
    }

    return sanitized;
  }

  async regenerateSection(
    brandContext: BrandContext,
    sectionType: "hero" | "about" | "features" | "contact",
    currentHtml: string,
  ): Promise<string> {
    const prompt = this.buildSectionPrompt(
      brandContext,
      sectionType,
      currentHtml,
    );

    const url = `${this.apiBaseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Gemini API error: ${response.status} ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage = `Gemini API error: ${errorJson.error.message}`;
          }
        } catch {
          if (errorText) {
            errorMessage = `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`;
          }
        }
        
        logger.error("Gemini API error in regenerateSection", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          model: this.model,
          sectionType,
        });
        
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as GeminiResponse;

      if (!data.candidates || data.candidates.length === 0) {
        logger.error("Gemini API returned no candidates in regenerateSection", {
          fullResponse: JSON.stringify(data),
        });
        throw new Error("Invalid response from Gemini API: No candidates returned");
      }

      const candidate = data.candidates[0];
      const finishReason = (candidate as any).finishReason;
      
      // Check for finishReason
      if (finishReason && finishReason !== "STOP") {
        if (finishReason === "MAX_TOKENS") {
          // MAX_TOKENS means response was truncated but we still got content
          logger.warn("Gemini API response truncated due to token limit in regenerateSection", {
            finishReason,
            sectionType,
          });
          // Continue with partial content
        } else {
          // Other finish reasons (SAFETY, etc.) mean content was blocked
          logger.error("Gemini API content blocked in regenerateSection", {
            finishReason,
            sectionType,
          });
          throw new Error(`Gemini API content blocked: ${finishReason}`);
        }
      }

      if (!candidate.content?.parts || candidate.content.parts.length === 0) {
        logger.error("Gemini API returned candidate with no content parts in regenerateSection", {
          sectionType,
        });
        throw new Error("Invalid response from Gemini API: No content parts in candidate");
      }

      const textPart = candidate.content.parts.find((part: any) => part.text);
      if (!textPart || !textPart.text) {
        logger.error("Gemini API returned no text content in regenerateSection", {
          sectionType,
          parts: candidate.content.parts,
        });
        throw new Error("Invalid response from Gemini API: No text content in parts");
      }

      let html = textPart.text;
      
      // If we hit MAX_TOKENS, the section might be incomplete but still usable
      if (finishReason === "MAX_TOKENS" && html && !html.trim().endsWith("</section>") && !html.trim().endsWith(">")) {
        logger.info("Completing truncated section HTML", {
          sectionType,
          htmlEnding: html.substring(Math.max(0, html.length - 50)),
        });
        // Try to close the section if it's incomplete
        if (html.includes("<section") && !html.includes("</section>")) {
          html += "\n</section>";
        }
      }

      return this.sanitizeHtml(html);
    } catch (error) {
      logger.error("Failed to regenerate section with Gemini", {
        error: error instanceof Error ? error.message : "Unknown error",
        sectionType,
      });
      throw error;
    }
  }

  private buildSectionPrompt(
    brandContext: BrandContext,
    sectionType: "hero" | "about" | "features" | "contact",
    currentHtml: string,
  ): string {
    const { brandName, colors, tone, products } = brandContext;

    const sectionDescriptions = {
      hero: "hero section with a compelling headline, subheadline, and call-to-action button",
      about: "about section describing the brand, its mission, and values",
      features: "features/services section showcasing key offerings with icons or visual elements",
      contact: "contact section with a contact form or contact information",
    };

    let prompt = `Generate a new ${sectionDescriptions[sectionType]} HTML section for the brand "${brandName}".

Current HTML context (for reference only):
${currentHtml.substring(0, 1000)}

Requirements:
1. Use inline CSS only
2. Match the color palette:
   - Primary: ${colors.primary}
   - Secondary: ${colors.secondary}
   - Accent: ${colors.accent}
3. Brand tone: ${tone}
4. Make it responsive and modern
5. Ensure it fits seamlessly with the rest of the page`;

    // Add products context for features section
    if (sectionType === "features" && products && products.length > 0) {
      prompt += `\n\nProducts/Services to Feature:
The section should showcase these products/services:`;
      products.forEach((product) => {
        const productInfo = [
          `- ${product.name}`,
          product.description ? `  Description: ${product.description}` : null,
          `  Price: ${product.price} ${product.currency}`,
          product.category ? `  Category: ${product.category}` : null,
          product.images && product.images.length > 0 ? `  Image: ${product.images[0]}` : null,
        ].filter(Boolean).join("\n");
        prompt += `\n${productInfo}`;
      });
      prompt += `\n\nCreate an attractive products/services showcase with cards or grid layout displaying each product with its name, description, price, and image.`;
    }

    prompt += `\n\nOutput ONLY the HTML for this section (the opening and closing tags for the section element), no explanations, no markdown.`;

    return prompt;
  }
}

