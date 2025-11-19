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
  widgets?: {
    enabled: boolean;
    contactForm?: {
      enabled: boolean;
      title: string;
      description?: string;
      position: string;
      displayMode?: string;
    };
    invoiceRequest?: {
      enabled: boolean;
      title: string;
      description?: string;
      position: string;
      displayMode?: string;
    };
    quoteRequest?: {
      enabled: boolean;
      title: string;
      description?: string;
      position: string;
      displayMode?: string;
    };
  };
  pageTitle?: string;
  pagePurpose?: string;
  pageSlug?: string;
  pageType?: string;
  pageContentEntries?: Array<{
    title: string;
    summary?: string;
    link?: string;
    image?: string;
    description?: string;
  }>;
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

  /**
   * Generate text using Gemini API (for text improvement, etc.)
   */
  async generateText(prompt: string): Promise<string> {
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
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as GeminiResponse;
        logger.error("Gemini API error", {
          status: response.status,
          error: errorData.error,
        });
        throw new Error(
          `Gemini API error: ${errorData.error?.message || response.statusText}`,
        );
      }

      const data = (await response.json()) as GeminiResponse;

      if (!data.candidates || data.candidates.length === 0) {
        logger.error("Gemini API returned no candidates", { data });
        throw new Error("Invalid response from Gemini API: No candidates");
      }

      const candidate = data.candidates[0];
      const finishReason = candidate.finishReason;

      const textPart = candidate.content?.parts?.find((part: any) => part.text);
      if (!textPart || !textPart.text) {
        logger.error("Gemini API returned no text content", {
          parts: candidate.content?.parts,
        });
        throw new Error("Invalid response from Gemini API: No text content in parts");
      }

      if (finishReason && finishReason !== "STOP") {
        if (finishReason === "MAX_TOKENS") {
          logger.warn("Gemini API response truncated due to token limit", {
            finishReason,
            textLength: textPart.text.length,
          });
        } else {
          logger.error("Gemini API content blocked", {
            finishReason,
            safetyRatings: (candidate as any).safetyRatings,
          });
          throw new Error(`Gemini API content blocked: ${finishReason}`);
        }
      }

      logger.info("Text generated successfully", {
        textLength: textPart.text.length,
        finishReason: finishReason || "STOP",
      });

      return textPart.text.trim();
    } catch (error) {
      logger.error("Failed to generate text with Gemini", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  private buildPrompt(brandContext: BrandContext): string {
    const {
      brandName,
      colors,
      logoUrl,
      tone,
      description,
      brandImages,
      context,
      contextImages,
      products,
      widgets,
      pageTitle,
      pagePurpose,
      pageSlug,
      pageType,
    } = brandContext;

    let prompt = `Generate a complete, modern, responsive website HTML page for a brand called "${brandName}". 

🚨 CRITICAL DATA ACCURACY RULES - READ CAREFULLY:
- Use ONLY the data provided in this prompt. DO NOT invent, hallucinate, or create fake data.
- If information is missing (e.g., no address, no phone, no testimonials), use placeholders like "[Address]" or "[Phone]" or simply omit that section.
- DO NOT create fake testimonials, fake customer names, fake reviews, or fake statistics.
- DO NOT invent company history, team members, or case studies that weren't provided.
- If you need additional data that isn't provided, use generic placeholders or omit that content entirely.
- All content must be based on the provided context, products, and brand information only.

Requirements:
1. Use inline CSS only (no external stylesheets)
2. Make it fully responsive (mobile-first design)
3. Use the following color palette EXCLUSIVELY for all interactive elements, buttons, links, and accents:
   - Primary: ${colors.primary} (use for primary buttons, active states, main CTAs)
   - Secondary: ${colors.secondary} (use for secondary buttons, borders, subtle accents)
   - Accent: ${colors.accent} (use for highlights, hover states, special elements)
4. Brand tone: ${tone}

COLOR CONTRAST REQUIREMENTS:
- Ensure all text has sufficient contrast (WCAG AA minimum: 4.5:1 for normal text, 3:1 for large text)
- Calculate text color based on background: use dark text (#111827 or darker) on light backgrounds, light text (#ffffff) on dark backgrounds
- Test contrast ratios: primary color on white, white text on primary color background
- If brand colors don't meet contrast requirements, adjust text colors accordingly (never change brand colors, only text colors)

BRAND COLOR USAGE (MANDATORY):
- ALL buttons must use --color-primary or --color-secondary
- ALL links must use --color-primary for default state, --color-accent for hover
- ALL active states, selected items, and highlights must use brand colors
- Navigation active state must use --color-primary
- CTAs and important actions must use --color-primary
- Borders and dividers can use --color-secondary
- Hover effects should use --color-accent
- DO NOT use generic colors (blue, red, green) - always use the provided brand colors`;

    if (description) {
      prompt += `\n5. Brand description: ${description}`;
    }

    if (logoUrl) {
      prompt += `\n6. Include the logo at: ${logoUrl}`;
    }

    if (brandImages && brandImages.length > 0) {
      prompt += `\n7. Include these brand images in the gallery section: ${brandImages.join(", ")}`;
    }

    if (pageTitle) {
      prompt += `\n\n🎯 PAGE-SPECIFIC REQUIREMENTS - THIS IS CRITICAL:
This HTML is for the "${pageTitle}" page.`;
    }

    if (pageSlug) {
      const href = pageSlug === "index" || pageSlug === "home" ? "/" : `/${pageSlug}`;
      prompt += `\nURL path: ${href}`;
    }

    if (pagePurpose) {
      prompt += `\n\n📋 PAGE PURPOSE & UNIQUENESS REQUIREMENTS:
Purpose: ${pagePurpose}

🚨 CRITICAL: This page MUST be visually and content-wise DISTINCT from other pages on the site:
- Use a UNIQUE layout structure that differs from the homepage and other pages
- Create page-specific content that focuses on the "${pageTitle}" topic
- Use a different hero section style (different background, different text arrangement, different visual elements)
- Include sections that are RELEVANT to this specific page's purpose, NOT generic sections
- Make the page title "${pageTitle}" prominent and clearly visible in the hero section
- Ensure the page has a clear visual identity that makes it obvious this is the "${pageTitle}" page
- DO NOT repeat the same content structure as other pages - be creative and unique
- The page should feel like a dedicated destination for "${pageTitle}" content, not a generic template`;
    }

    if (brandContext.pageContentEntries && brandContext.pageContentEntries.length > 0) {
      prompt += `\n\n📝 USER-CREATED CONTENT ENTRIES (CRITICAL - USE THESE EXACTLY):
The following entries are REAL user-created content. You MUST use these entries and ONLY these entries. DO NOT create fake or placeholder content.`;
      brandContext.pageContentEntries.forEach((entry, index) => {
        prompt += `\n\nEntry ${index + 1}:
- Title: ${entry.title}
${entry.description ? `- Description (use this rich HTML content directly): ${entry.description}` : ""}
${entry.summary ? `- Summary: ${entry.summary}` : ""}
${entry.image ? `- Featured Image: ${entry.image}` : ""}
${entry.link ? `- Link: ${entry.link}` : ""}`;
      });
      prompt += `\n\nIMPORTANT: Display these entries exactly as provided. Use the description HTML directly if provided. Do not modify or create additional fake content.`;
    }

    if (pageType === "blog") {
      prompt += `\n\n📰 BLOG PAGE SPECIFIC REQUIREMENTS:
This is a blog/articles page. 
- Create a UNIQUE blog-style layout with article cards, featured posts, and category filters
- Use a blog-appropriate color scheme and typography
- Make it visually distinct from other pages with a magazine-style or news-style layout
- DO NOT include generic "About" or "Services" sections - focus on blog content
- CRITICAL: DO NOT create fake or placeholder blog posts/articles
- CRITICAL: Create a static layout structure with a container element for dynamic blog articles
- The container should have id="blog-articles-container" and be styled appropriately (grid, flex, or card layout)
- DO NOT hardcode any article content - the articles will be loaded dynamically via JavaScript
- Include an empty state message in the container like "Loading articles..." or "No articles yet"
- The layout should be ready to display real user-created articles that will be loaded dynamically
- Structure the page with:
  * A hero/header section for the blog page title
  * A main content area with id="blog-articles-container" for dynamic articles
  * Article cards will be inserted into this container via JavaScript
  * Style the container to display articles in a grid or list format`;
    } else if (pageType === "contact") {
      prompt += `\n\n📞 CONTACT PAGE SPECIFIC REQUIREMENTS:
This is a contact/engagement page.
- Create a UNIQUE contact-focused layout with clear contact information
- Include office locations, phone numbers, email addresses prominently
- Add a map section if location data is available
- Use a contact-appropriate layout (maybe split-screen with info on one side, form placeholder on other)
- Include business hours, social media links, and multiple ways to reach out
- Make it visually distinct with a clean, approachable design
- DO NOT include generic "Features" or "Products" sections - focus on contact information`;
    } else {
      prompt += `\n\n📄 STANDARD PAGE REQUIREMENTS:
This is a standard content page.
- Create content sections that are SPECIFIC to "${pageTitle || 'this page'}"
- DO NOT use generic "About, Features/Services, Contact" sections unless they're specifically relevant
- Focus on content that serves the page's unique purpose
- Use a layout that's appropriate for the page's content type
- Make it visually distinct from other pages on the site`;
    }

    prompt += `\n\nNavigation will be injected automatically, so focus on unique content for this page and avoid creating navigation bars manually.`;

    prompt += `\n\n10. Use modern CSS (flexbox/grid, smooth transitions)
11. Create a prominent hero section that clearly identifies this as the "${pageTitle || 'page'}" page with the page title visible

LAYOUT & POSITIONING REQUIREMENTS:
- Use CSS Grid or Flexbox for all layouts (never use absolute positioning except for overlays/modals)
- Consistent spacing system: 16px base unit (1rem)
  * Section padding: 48px-64px (3rem-4rem) vertical, 24px-32px (1.5rem-2rem) horizontal
  * Element gaps: 16px-24px (1rem-1.5rem) between related elements
  * Card padding: 24px (1.5rem)
- Max content width: 1200px, centered with margin: 0 auto
- Responsive breakpoints:
  * Mobile: < 768px (single column, full width, reduced padding)
  * Tablet: 768px - 1024px (2 columns max)
  * Desktop: > 1024px (full layout)
- All elements must be properly aligned (use flexbox/grid alignment, not manual positioning)
- No overlapping elements (ensure proper z-index only for overlays)
- Consistent vertical rhythm (use consistent line-height: 1.5-1.75)

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

    // Add widget context and instructions
    if (widgets && widgets.enabled) {
      prompt += `\n\n🚨 CRITICAL: Widget Integration Instructions - READ CAREFULLY 🚨
The organization has configured fully functional widgets that will be automatically loaded via a script tag. These widgets are REAL, WORKING components that handle form submissions, validation, and data processing.

⚠️ STRICT PROHIBITION: 
- DO NOT create ANY contact forms, invoice request forms, or quote request forms in the HTML
- DO NOT create placeholder forms, mock forms, or non-functional form elements
- DO NOT create <form> tags, <input> fields, or <button> elements for these purposes
- DO NOT create buttons with text like "Request a Quote", "Request an Invoice", "Contact Us", "Get a Quote", "Request a Personalized Quote" - these are widget-related actions
- DO NOT create any HTML that looks like a contact/invoice/quote form or button
- These widgets are already implemented and will be injected automatically

Available Widgets (These are REAL, functional widgets - not placeholders):`;
      
      const inlineWidgets: string[] = [];
      
      if (widgets.contactForm?.enabled) {
        const displayMode = widgets.contactForm.displayMode || "floating";
        prompt += `\n- Contact Form Widget: "${widgets.contactForm.title}"${widgets.contactForm.description ? ` - ${widgets.contactForm.description}` : ""}
  Position: ${widgets.contactForm.position}
  Display Mode: ${displayMode}`;
        
        if (displayMode === "inline") {
          inlineWidgets.push("contactForm");
          prompt += `\n  ⚠️ INLINE MODE: You MUST add a placeholder div where you want the widget to appear:
  <div data-financely-widget="contactForm"></div>
  The widget-loader.js will automatically replace this div with the functional contact form.`;
        } else {
          prompt += `\n  ✅ FLOATING MODE: The widget-loader.js will automatically create a floating button. You do NOT need to add anything.`;
        }
      }
      
      if (widgets.invoiceRequest?.enabled) {
        const displayMode = widgets.invoiceRequest.displayMode || "floating";
        prompt += `\n- Invoice Request Widget: "${widgets.invoiceRequest.title}"${widgets.invoiceRequest.description ? ` - ${widgets.invoiceRequest.description}` : ""}
  Position: ${widgets.invoiceRequest.position}
  Display Mode: ${displayMode}`;
        
        if (displayMode === "inline") {
          inlineWidgets.push("invoiceRequest");
          prompt += `\n  ⚠️ INLINE MODE: You MUST add a placeholder div where you want the widget to appear:
  <div data-financely-widget="invoiceRequest"></div>
  The widget-loader.js will automatically replace this div with the functional invoice request form.`;
        } else {
          prompt += `\n  ✅ FLOATING MODE: The widget-loader.js will automatically create a floating button. You do NOT need to add anything.`;
        }
      }
      
      if (widgets.quoteRequest?.enabled) {
        const displayMode = widgets.quoteRequest.displayMode || "floating";
        prompt += `\n- Quote Request Widget: "${widgets.quoteRequest.title}"${widgets.quoteRequest.description ? ` - ${widgets.quoteRequest.description}` : ""}
  Position: ${widgets.quoteRequest.position}
  Display Mode: ${displayMode}`;
        
        if (displayMode === "inline") {
          inlineWidgets.push("quoteRequest");
          prompt += `\n  ⚠️ INLINE MODE: You MUST add a placeholder div where you want the widget to appear:
  <div data-financely-widget="quoteRequest"></div>
  The widget-loader.js will automatically replace this div with the functional quote request form.`;
        } else {
          prompt += `\n  ✅ FLOATING MODE: The widget-loader.js will automatically create a floating button. You do NOT need to add anything.`;
        }
      }
      
      prompt += `\n\n✅ WHAT YOU SHOULD DO INSTEAD:
- Focus on creating engaging content: hero sections, product showcases, service descriptions, testimonials, company information
- Create general call-to-action buttons for general actions (e.g., "Learn More", "View Products", "See Our Work", "Explore Services")
- DO NOT create buttons specifically for contact/invoice/quote actions - the widgets handle those
- For inline widgets: Add the required placeholder div (<div data-financely-widget="widgetType"></div>) in an appropriate location within your content
- For floating widgets: Do nothing - the widget-loader.js will create the floating button automatically
- Create compelling content that naturally leads users to want to contact, request quotes, or request invoices

🔧 TECHNICAL DETAILS:
- The widget script (<script src="/widget-loader.js">) will be automatically injected before the closing </body> tag
- Floating widgets: widget-loader.js automatically creates a floating button based on the configured position (bottom-right, top-left, etc.)
- Inline widgets: widget-loader.js looks for <div data-financely-widget="widgetType"></div> and replaces it with the functional form
- All widget functionality (forms, validation, submissions) is handled by widget-loader.js - you do NOT implement any of this
- Widgets integrate with the organization's backend automatically

REMEMBER: 
- NO form elements, NO widget-related buttons (like "Request Quote", "Contact Us", "Get Invoice")
- For inline widgets: Add the placeholder div with the correct data attribute
- For floating widgets: Do nothing - the button appears automatically
- Focus on content, not widget functionality`;
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
    const { brandName, colors, tone, products, widgets } = brandContext;

    const sectionDescriptions = {
      hero: "hero section with a compelling headline, subheadline, and call-to-action button",
      about: "about section describing the brand, its mission, and values",
      features: "features/services section showcasing key offerings with icons or visual elements",
      contact: "contact section with contact information and call-to-action",
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

    // Add widget context and instructions (especially important for contact section)
    if (widgets && widgets.enabled) {
      prompt += `\n\n🚨 CRITICAL: Widget Integration Instructions
The organization has configured fully functional widgets that will be automatically loaded. DO NOT create any contact forms, invoice request forms, or quote request forms in this section.

⚠️ STRICT PROHIBITION: 
- DO NOT create <form> tags, <input> fields, or form buttons
- DO NOT create placeholder or mock forms
- DO NOT create buttons with text like "Contact Us", "Request a Quote", "Get an Invoice", "Request a Personalized Quote" - these are widget-related actions
- These widgets are already implemented and will be injected automatically

Available Widgets:`;
      
      const inlineWidgets: string[] = [];
      
      if (widgets.contactForm?.enabled) {
        const displayMode = widgets.contactForm.displayMode || "floating";
        prompt += `\n- Contact Form Widget: "${widgets.contactForm.title}"${widgets.contactForm.description ? ` - ${widgets.contactForm.description}` : ""}
  Position: ${widgets.contactForm.position}
  Display Mode: ${displayMode}`;
        
        if (displayMode === "inline") {
          inlineWidgets.push("contactForm");
          prompt += `\n  ⚠️ INLINE MODE: You MUST add: <div data-financely-widget="contactForm"></div>`;
        } else {
          prompt += `\n  ✅ FLOATING MODE: widget-loader.js creates the button automatically - do nothing`;
        }
      }
      
      if (widgets.invoiceRequest?.enabled) {
        const displayMode = widgets.invoiceRequest.displayMode || "floating";
        prompt += `\n- Invoice Request Widget: "${widgets.invoiceRequest.title}"${widgets.invoiceRequest.description ? ` - ${widgets.invoiceRequest.description}` : ""}
  Position: ${widgets.invoiceRequest.position}
  Display Mode: ${displayMode}`;
        
        if (displayMode === "inline") {
          inlineWidgets.push("invoiceRequest");
          prompt += `\n  ⚠️ INLINE MODE: You MUST add: <div data-financely-widget="invoiceRequest"></div>`;
        } else {
          prompt += `\n  ✅ FLOATING MODE: widget-loader.js creates the button automatically - do nothing`;
        }
      }
      
      if (widgets.quoteRequest?.enabled) {
        const displayMode = widgets.quoteRequest.displayMode || "floating";
        prompt += `\n- Quote Request Widget: "${widgets.quoteRequest.title}"${widgets.quoteRequest.description ? ` - ${widgets.quoteRequest.description}` : ""}
  Position: ${widgets.quoteRequest.position}
  Display Mode: ${displayMode}`;
        
        if (displayMode === "inline") {
          inlineWidgets.push("quoteRequest");
          prompt += `\n  ⚠️ INLINE MODE: You MUST add: <div data-financely-widget="quoteRequest"></div>`;
        } else {
          prompt += `\n  ✅ FLOATING MODE: widget-loader.js creates the button automatically - do nothing`;
        }
      }
      
      if (sectionType === "contact") {
        prompt += `\n\nFor the contact section specifically:
- Create contact information (address, phone, email) if available
- Create general CTA buttons like "Learn More", "View Our Services", "Explore Products" - NOT widget-specific buttons
- DO NOT create buttons like "Contact Us", "Get in Touch", "Send a Message" - the widget handles those
- DO NOT create any form HTML - the widget will handle all form functionality`;
        
        if (inlineWidgets.includes("contactForm")) {
          prompt += `\n- Since contactForm is in INLINE mode, add the placeholder div: <div data-financely-widget="contactForm"></div> where you want the form to appear`;
        }
      } else {
        prompt += `\n\n✅ WHAT TO DO:
- Create engaging content and general CTAs (not widget-specific)
- Focus on content that drives engagement
- The widgets will handle all form functionality automatically`;
        
        if (inlineWidgets.length > 0) {
          prompt += `\n- For inline widgets, add the required placeholder divs: ${inlineWidgets.map(w => `<div data-financely-widget="${w}"></div>`).join(", ")}`;
        }
      }
    }

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

