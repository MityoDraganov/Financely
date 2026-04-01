import { logger } from "firebase-functions";
import { AIService } from "./ai-service";
import { getAIService } from "./ai-service";
import { Organization } from "../../core/entities/organization";
import type { EmailTemplateData } from "../../core/entities/email-template";
import type { EmailGenerationData } from "../../genkit/schemas";

type DynamicSourceValueType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "array"
  | "object"
  | "unknown";

type AIEmailDynamicSource = {
  placeholderKey: string;
  entity: "product" | "contact" | "invoice" | "proposal";
  path: string;
  label?: string;
  description?: string;
  valueType?: DynamicSourceValueType;
  required?: boolean;
  sourceKind?: "field" | "metafield";
};

type GenerateEmailTemplateOptions = {
  style?: "modern" | "classic" | "minimal" | "professional" | "newsletter" | "transactional";
  customPrompt?: string;
  images?: Array<{
    url: string;
    purpose: "reference" | "use-in-template";
    description?: string;
  }>;
  context?: {
    products?: Array<{ name: string; description?: string; price?: number; imageUrl?: string }>;
    organizationName?: string;
    organizationSettings?: Record<string, unknown>;
    galleryImages?: string[];
  };
  allowedContexts?: string[];
  dynamicSources?: AIEmailDynamicSource[];
  generateCustomHtml?: boolean;
  targetSection?: "header" | "body" | "footer" | "full";
};

type EmailGenerationModelResult = Omit<EmailGenerationData, "blocks" | "sections"> & {
  blocks: {
    header: Array<any>;
    body: Array<any>;
    footer: Array<any>;
  };
};

/**
 * Service for generating email templates using AI
 * Creates beautiful, functional email templates with proper HTML structure
 */
export class EmailTemplateGenerationService {
  private aiService: AIService;

  constructor(aiService?: AIService) {
    this.aiService = aiService || getAIService();
  }

  /**
   * Generate an email template based on organization context, images, and user instructions
   */
  async generateEmailTemplate(
    organization: Organization,
    options?: GenerateEmailTemplateOptions,
  ): Promise<EmailTemplateData> {
    // Build context from organization data
    const context = this.buildOrganizationContext(organization, options?.context);
    
    // Create prompt for AI
    const prompt = this.buildEmailTemplatePrompt(context, organization, options);
    
    // Define the expected JSON schema for email template data
    const schema = {
      type: "object" as const,
      properties: {
        name: { type: "string" as const, description: "Template name" },
        description: { type: "string" as const, description: "Template description" },
        subject: { type: "string" as const, description: "Email subject line" },
        preheader: { type: "string" as const, description: "Email preheader text (preview text)" },
        htmlContent: { type: "string" as const, description: "Complete HTML email content" },
        blocks: {
          type: "object" as const,
          description: "Structured blocks organized by section",
          properties: {
            header: {
              type: "array" as const,
              description: "Blocks for the header section (logo, navigation, etc.)",
              items: { type: "object" as const },
            },
            body: {
              type: "array" as const,
              description: "Blocks for the body section (main content, text, images, buttons, etc.)",
              items: { type: "object" as const },
            },
            footer: {
              type: "array" as const,
              description: "Blocks for the footer section (contact info, unsubscribe, social links, etc.)",
              items: { type: "object" as const },
            },
          },
          required: ["header", "body", "footer"],
        },
        designTokens: {
          type: "object" as const,
          properties: {
            background: { type: "string" as const },
            surface: { type: "string" as const },
            text: { type: "string" as const },
            primary: { type: "string" as const },
            fontFamily: { type: "string" as const },
            borderRadius: { type: "number" as const },
          },
        },
        placeholders: {
          type: "array" as const,
          description:
            "Dynamic placeholders used in htmlContent/subject/preheader. Include only placeholders actually used.",
          items: {
            type: "object" as const,
            properties: {
              id: { type: "string" as const },
              key: { type: "string" as const },
              label: { type: "string" as const },
              description: { type: "string" as const },
              source: {
                type: "object" as const,
                properties: {
                  type: { type: "string" as const, enum: ["entity_field"] },
                  entity: {
                    type: "string" as const,
                    enum: ["product", "contact", "invoice", "proposal"],
                  },
                  path: { type: "string" as const },
                  valueType: {
                    type: "string" as const,
                    enum: ["string", "number", "boolean", "date", "array", "object", "unknown"],
                  },
                },
              },
            },
            required: ["key"],
          },
        },
      },
      required: ["name", "subject", "htmlContent", "blocks", "designTokens"],
    };
    
    try {
      const result = await this.aiService.generateJSON<EmailGenerationModelResult>(prompt, schema, {
        temperature: 0.7,
        maxTokens: 32768, // Large token limit for full HTML email content
      });
      
      // Use the structured blocks from AI response
      // Ensure each block has an id and correct section
      const headerBlocks = (result.blocks.header || []).map((block: any, index: number) => ({
        ...block,
        id: block.id || `block-header-${Date.now()}-${index}`,
        section: "header" as const,
      }));
      
      const bodyBlocks = (result.blocks.body || []).map((block: any, index: number) => ({
        ...block,
        id: block.id || `block-body-${Date.now()}-${index}`,
        section: "body" as const,
      }));
      
      const footerBlocks = (result.blocks.footer || []).map((block: any, index: number) => ({
        ...block,
        id: block.id || `block-footer-${Date.now()}-${index}`,
        section: "footer" as const,
      }));
      
      // Combine all blocks from all sections into a single array
      const allBlocks = [...headerBlocks, ...bodyBlocks, ...footerBlocks];
      
      // Build sections from the structured blocks
      const sections = {
        header: headerBlocks.map((block) => block.id),
        body: bodyBlocks.map((block) => block.id),
        footer: footerBlocks.map((block) => block.id),
      };
      
      // Build template data
      const template: EmailTemplateData = {
        orgId: organization.id,
        name: result.name || "AI Generated Email Template",
        description: result.description,
        subject: result.subject,
        preheader: result.preheader,
        htmlContent: result.htmlContent,
        blocks: allBlocks,
        designTokens: result.designTokens || {
          background: "#ffffff",
          surface: "#f8fafc",
          text: "#0f172a",
          primary: organization.settings?.brandColors?.primary || "#2563eb",
          fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          borderRadius: 12,
        },
        placeholders: (result.placeholders ?? [])
          .filter((placeholder) => typeof placeholder?.key === "string" && placeholder.key.trim().length > 0)
          .map((placeholder) => ({
            id: placeholder.id || `placeholder-${placeholder.key.trim().toLowerCase()}`,
            key: placeholder.key.trim(),
            label: placeholder.label,
            description: placeholder.description,
            source: placeholder.source,
          })),
        status: "draft",
        version: 1,
        isSystemDefault: false,
        isLocked: false,
        allowedContexts: options?.allowedContexts ?? [],
        sections,
      };
      
      logger.info("Email template generated successfully", {
        organizationId: organization.id,
        templateName: template.name,
        blockCount: allBlocks.length,
        htmlLength: result.htmlContent.length,
      });
      
      return template;
    } catch (error) {
      logger.error("Failed to generate email template", {
        error: error instanceof Error ? error.message : "Unknown error",
        organizationId: organization.id,
      });
      throw new Error(
        `Failed to generate email template: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Build context string from organization data
   */
  private buildOrganizationContext(
    orgData: Organization,
    additionalContext?: {
      products?: Array<{ name: string; description?: string; price?: number; imageUrl?: string }>;
      organizationName?: string;
      organizationSettings?: Record<string, unknown>;
      galleryImages?: string[];
    }
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
      parts.push(`Brand Colors: Primary ${brandColors.primary || "#2563eb"}, Secondary ${brandColors.secondary || "#6b7280"}, Accent ${brandColors.accent || "#10b981"}`);
    }
    
    const logoUrl = orgData.settings?.branding?.customLogo || orgData.logoUrl;
    if (logoUrl) {
      parts.push(`Logo URL: ${logoUrl}`);
    }
    
    // Organization URLs for buttons and links
    const websiteUrl = orgData.website || orgData.settings?.branding?.customDomain;
    if (websiteUrl) {
      parts.push(`Website URL: ${websiteUrl}`);
      parts.push(`Use this URL for buttons, links, and call-to-action elements: ${websiteUrl}`);
    } else {
      parts.push(`⚠️ Website URL not available - use placeholder "#" for buttons/links that need to be filled by user`);
    }
    
    if (additionalContext?.products && additionalContext.products.length > 0) {
      parts.push(`\n📦 Available Products (${additionalContext.products.length}) - FOR CONTEXT ONLY:`);
      parts.push(`⚠️ IMPORTANT: These products are available for reference, but DO NOT include them in the email unless:`);
      parts.push(`   1. The user explicitly requests products in their prompt, OR`);
      parts.push(`   2. The email type is specifically product-focused (product announcement, catalog, etc.)`);
      parts.push(`   For most email types (newsletter, transactional, welcome, etc.), DO NOT include products.`);
      additionalContext.products.forEach((p, idx) => {
        parts.push(`  ${idx + 1}. ${p.name}${p.description ? ` - ${p.description}` : ""}${p.price ? ` - $${p.price}` : ""}${p.imageUrl ? ` [Image: ${p.imageUrl}]` : ""}`);
      });
    }
    
    if (additionalContext?.galleryImages && additionalContext.galleryImages.length > 0) {
      parts.push(`\nAvailable Gallery Images (${additionalContext.galleryImages.length}):`);
      additionalContext.galleryImages.slice(0, 10).forEach((url, idx) => {
        parts.push(`  ${idx + 1}. ${url}`);
      });
      if (additionalContext.galleryImages.length > 10) {
        parts.push(`  ... and ${additionalContext.galleryImages.length - 10} more`);
      }
    }
    
    return parts.join("\n");
  }

  /**
   * Build the prompt for AI email template generation
   */
  private buildEmailTemplatePrompt(
    context: string,
    organization: Organization,
    options?: GenerateEmailTemplateOptions,
  ): string {
    const style = options?.style || "modern";
    const targetSection = options?.targetSection || "full";
    const generateCustomHtml = options?.generateCustomHtml || false;
    const allowedContexts = options?.allowedContexts ?? [];
    const dynamicSources = (options?.dynamicSources ?? []).filter(
      (source) =>
        typeof source?.placeholderKey === "string" &&
        source.placeholderKey.trim().length > 0 &&
        typeof source?.entity === "string" &&
        typeof source?.path === "string" &&
        source.path.trim().length > 0,
    );
    
    const logoUrl = organization.settings?.branding?.customLogo || organization.logoUrl;
    const brandColors = organization.settings?.brandColors || {
      primary: "#2563eb",
      secondary: "#6b7280",
      accent: "#10b981",
    };
    
    let prompt = `You are a professional email template designer with deep expertise in high-converting email design. Create a beautiful, functional, and email-client-compatible HTML email template.

Organization Context:
${context}

Design Requirements:
- Style: ${style} (${this.getStyleDescription(style)})
- Target Section: ${targetSection === "full" ? "Complete email template (header, body, footer)" : `Only ${targetSection} section`}
- Email clients: Must work in Gmail, Outlook, Apple Mail, and other major email clients
- Use table-based layouts for maximum compatibility
- All styles must be inline (no external CSS)
- Use web-safe fonts with fallbacks
- Maximum width: 600px for email container
- Mobile-responsive design with media queries where supported

Brand Colors:
- Primary: ${brandColors.primary}
- Secondary: ${brandColors.secondary}
- Accent: ${brandColors.accent}

${allowedContexts.length > 0 ? `Template Compatibility Context:
- Allowed Contexts: ${allowedContexts.join(", ")}
- You MUST keep the generated dynamic placeholders and content compatible with these contexts.
- Do not introduce placeholders that require entities outside what these contexts support.` : ""}

${dynamicSources.length > 0 ? `Dynamic Source Contract (STRICT):
- You may use ONLY these dynamic placeholder keys when generating dynamic content.
- Placeholder syntax is exactly: {{placeholder_key}}
- Do NOT invent new placeholder keys, entity names, or data paths.
- If you use any dynamic placeholder in subject, preheader, or htmlContent, include it in the returned "placeholders" array with matching source metadata.
- If no dynamic fields are used, return "placeholders": [].
- Available dynamic sources (${dynamicSources.length} total):
${dynamicSources.slice(0, 120).map((source, idx) => `  ${idx + 1}. {{${source.placeholderKey}}} -> ${source.entity}.${source.path}${source.valueType ? ` (${source.valueType})` : ""}${source.required ? " [required]" : ""}${source.label ? ` | ${source.label}` : ""}`).join("\n")}
${dynamicSources.length > 120 ? `  ... and ${dynamicSources.length - 120} more sources` : ""}` : ""}

📧 PROFESSIONAL EMAIL DESIGN PRINCIPLES (FOLLOW THESE):

1. CORE PRINCIPLES:
   - Clarity over creativity: Users skim emails in 3-5 seconds. Make it readable instantly.
   - One primary goal per email: Every template should have ONE main action.
   - Scannable visual hierarchy: Short blocks, strong headings, clear spacing.
   - Mobile-first: 70-80% of opens happen on phones. Design for mobile first.
   - Safe HTML: Use table-based layout (industry standard for email compatibility).

2. UNIVERSAL LAYOUT STRUCTURE:
   A. Preheader Text: 35-90 characters, hidden in body but visible in inbox preview
   B. Header: Logo centered, optional nav links (desktop only)
   C. Hero Block: Short headline (max 7 words), one-paragraph explanation, CTA button
   D. Content Blocks: Reusable text, image+text, icon grid, button row, divider
   E. CTA Block: Always isolate your primary action
   F. Footer: Brand identity, address, unsubscribe, legal links

3. DESIGN SYSTEM RULES:
   Typography:
   - Base: 16px
   - Headlines: 20-28px (h1: 24-32px, h2: 20-24px, h3: 18-20px)
   - Line height: 1.4-1.6 for body, 1.2-1.3 for headings
   - Fonts: System fonts (Arial, Helvetica) for email-client safety
   - Font weights: 700 for h1, 600 for h2, 500 for emphasis, 400 for body
   - Minimum 4-6px size difference between heading levels
   
   Colors:
   - Primary color: Use ONLY for CTA buttons and highlights
   - Background: white or off-white (#f8f8f8)
   - Secondary: muted grey (#666/#888) for body text
   
   Spacing:
   - Section padding: 28-40px
   - Inner cell padding: 16-20px
   - Consistent spacing rhythm (use multiples of 4px: 8, 12, 16, 20, 24, 32px)
   
   Layout:
   - 600px fixed-width table
   - 100% width on mobile via fluid containers
   - Stack images + text on mobile
   
   Buttons:
   - Height: 44-48px
   - Padding: 16px horizontal
   - Rounded: 6px
   - Text: bold, white
   - Full-width on mobile
   
   Images:
   - Max width: 600px
   - Compress to <150kb
   - Avoid background images (they fail in Outlook)
   
   LOGO SIZING - CRITICAL:
   - Logos MUST have: max-width: 120-160px, width: auto, height: auto, max-height: 80px
   - Logo should NEVER take more than 20% of total email height
   - Header padding should be reasonable: 20-32px (not excessive)
   - Logo must be properly sized inline: style="display:block; max-width:160px; width:auto; height:auto; max-height:80px;"
   - Example: <img src="logo.jpg" alt="Logo" style="display:block; max-width:160px; width:auto; height:auto; max-height:80px;" />

4. BEHAVIORAL PSYCHOLOGY:
   - F-pattern: Readers scan top → left → right → scroll. Place CTA in this path.
   - Hick's Law: Fewer choices = faster decision. One CTA = better conversion.
   - Consistency: Match brand voice across emails, site, and app for higher trust.
   - Loss aversion: Deadlines or "don't miss" messaging drives action.
   - Social proof: Testimonials, badges, reviews add instant trust.

5. EMAIL TYPE PATTERNS:
   Welcome/Onboarding: Logo → Bold headline → 1-2 benefit sentences → Main CTA → Secondary micro-CTA → Social proof → Footer
   Transactional: Status badge → Summary card (items, price, delivery) → CTA → Support info
   Newsletter: Hero header → 2-5 content blocks (thumbnail + headline + summary + "Read more") → Footer
   Promotion: Big visual/text banner → Short pitch → Offer box → CTA → Secondary offers (2-4 cards)
   
6. LAYOUT & POSITIONING SENSE:
   - Use COLUMNS blocks for side-by-side content (products, galleries, features)
   - Stack elements vertically for mobile-first approach
   - Group related content together (heading + paragraph, image + text)
   - Use dividers/spacers to create visual separation between sections
   - Center-align logos and primary CTAs
   - Left-align body text for readability
   - Create visual flow: top to bottom, most important first

🚨 CRITICAL IMAGE USAGE RULES:
- You MUST ONLY use images that are explicitly provided in this prompt
- DO NOT create placeholder images, data URIs, or placeholder image service URLs
- DO NOT use URLs like "B84A62?text=...", "000000?text=...", or any placeholder image services
- DO NOT use data URIs for images (data:image/...)
- DO NOT invent or generate image URLs
- If no images are provided for a section, use CSS background colors or gradients instead of images
- If you need an image but none is provided, omit the image entirely and use text/color-based design
- ALL images must be valid URLs from the provided list below`;

    // Add image information
    if (logoUrl) {
      prompt += `\n- Logo URL (use in header): ${logoUrl}`;
    }
    
    if (options?.images && options.images.length > 0) {
      const referenceImages = options.images.filter(img => img.purpose === "reference");
      const useImages = options.images.filter(img => img.purpose === "use-in-template");
      
      if (referenceImages.length > 0) {
        prompt += `\n- Reference Images (use as design inspiration, DO NOT use these URLs in the HTML):`;
        referenceImages.forEach((img, idx) => {
          prompt += `\n  ${idx + 1}. ${img.url}${img.description ? ` - ${img.description}` : ""}`;
        });
      }
      
      if (useImages.length > 0) {
        prompt += `\n- Images to Use in Template (use these URLs in <img> tags):`;
        useImages.forEach((img, idx) => {
          prompt += `\n  ${idx + 1}. ${img.url}${img.description ? ` - ${img.description}` : ""}`;
        });
      }
    }
    
    // CRITICAL: Only mention images that were explicitly selected in the dialog
    // Do NOT mention galleryImages from context - those are just for reference in the UI
    // The AI should ONLY use images from the options.images array
    
    prompt += `\n\n🚨🚨🚨 CRITICAL IMAGE USAGE RULE 🚨🚨🚨
⚠️ YOU MUST ONLY USE IMAGES THAT ARE EXPLICITLY LISTED ABOVE IN THE "Images to Use in Template" SECTION.
⚠️ DO NOT use any images that are not in that list.
⚠️ DO NOT use placeholder image URLs, data URIs, or any other image sources.
⚠️ If an image is not in the "Images to Use in Template" list above, DO NOT use it. Use CSS colors/gradients instead or omit the image entirely.
⚠️ The organization may have other images in their gallery, but you MUST NOT use them unless they are explicitly listed above.`;

    prompt += `\n\n🚨🚨🚨 CRITICAL: HTML STRUCTURE FOR VISUAL BUILDER - ABSOLUTE REQUIREMENTS 🚨🚨🚨

${generateCustomHtml ? "⚠️ CUSTOM HTML MODE: You may include minimal custom HTML for truly custom elements, but MOST of your template should use standard HTML elements that map to visual blocks." : "🚫🚫🚫 ABSOLUTE PROHIBITION: generateCustomHtml is FALSE. You MUST NOT generate any custom HTML. You MUST use ONLY the standard block types listed below. Any custom HTML will break the visual builder. 🚫🚫🚫"}

AVAILABLE BLOCK TYPES AND THEIR EXACT HTML STRUCTURE:

1. TEXT BLOCK:
   Structure: <p> or <h1>-<h6> with text content
   Example: <p style="font-size:16px; color:#333333;">Your text here</p>
   Example: <h1 style="font-size:24px; color:#B84A62;">Heading text</h1>
   Rules: Simple text elements, no complex nesting. Each paragraph/heading = one text block.

2. IMAGE BLOCK:
   Structure: <img> tag with src and alt
   Example: <img src="https://example.com/image.jpg" alt="Description" style="display:block; max-width:100%; height:auto;" />
   Rules: Standalone <img> tags. Each image = one image block.

3. BUTTON BLOCK:
   Structure: <a> tag with button styling (background-color, padding, border-radius, display:inline-block)
   Example: <a href="#" style="background-color:#B84A62; color:#FFFFFF; padding:12px 24px; border-radius:5px; text-decoration:none; display:inline-block;">Button Text</a>
   Rules: Must have background-color AND padding to be recognized as button. Each button = one button block.

4. DIVIDER BLOCK:
   Structure: <hr> tag
   Example: <hr style="border:none; border-top:1px solid #e5e7eb; margin:16px 0;" />
   Rules: Simple <hr> tag. Each divider = one divider block.

5. COLUMNS BLOCK (for side-by-side content):
   Structure: <table role="presentation"> with <tr> containing multiple <td> elements
   Example for 2 columns:
   <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
     <tr>
       <td width="50%" valign="top" style="padding-right:6px;">
         <img src="image1.jpg" alt="Image 1" style="display:block; max-width:100%;" />
       </td>
       <td width="50%" valign="top" style="padding-left:6px;">
         <p style="font-size:14px;">Text content</p>
       </td>
     </tr>
   </table>
   Rules: Each <td> contains simple blocks (text, image, button). Use columns for product grids, image galleries, side-by-side content.

6. LOGO BLOCK:
   Structure: <img> tag, optionally wrapped in <a>
   Example: <a href="#"><img src="logo.jpg" alt="Logo" style="display:block; max-width:160px; width:auto; height:auto; max-height:80px;" /></a>
   Rules: Simple logo image, typically in header. 
   CRITICAL LOGO SIZING RULES:
   - MUST include: max-width: 120-160px, width: auto, height: auto, max-height: 80px
   - Logo should NEVER take more than 20% of total email height
   - Header padding should be 20-32px (not excessive)
   - Always set width:auto and height:auto to maintain aspect ratio
   - Example with ALL required styles: style="display:block; max-width:160px; width:auto; height:auto; max-height:80px;"

7. CONTAINER BLOCK (nested layout group):
   Structure: A grouped block that contains nested child blocks with explicit layout properties.
   Required block fields:
   {
     "type": "container",
     "section": "header|body|footer",
     "maxWidth": 520 | 600 | 680 | 800,
     "align": "left" | "center" | "right",
     "layoutDirection": "vertical" | "horizontal",
     "contentAlign": "left" | "center" | "right",
     "justifyContent": "start" | "center" | "end" | "space-between",
     "gap": number,
     "padding": "none" | "xs" | "sm" | "md" | "lg",
     "blocks": [nested blocks...]
   }
   Rules:
   - Use containers to group related blocks and control nested layout.
   - Container blocks may include text/image/button/divider/spacer/columns/container blocks.
   - Keep nesting depth practical (max 3 levels total).

🚫 FORBIDDEN STRUCTURES (when generateCustomHtml is false):
- Complex nested tables with multiple levels
- Tables with images AND text in the same cell (use columns block instead)
- Custom div structures that don't map to blocks
- Inline styles that create complex layouts
- Any HTML that cannot be parsed into the block types above

✅ CORRECT STRUCTURE EXAMPLES:

Example 1: Product showcase with image + text side by side (use COLUMNS):
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td width="50%" valign="top" style="padding-right:6px;">
      <img src="product.jpg" alt="Product" style="display:block; max-width:100%; height:auto;" />
    </td>
    <td width="50%" valign="top" style="padding-left:6px;">
      <h3 style="font-size:18px; color:#B84A62; margin:0 0 10px 0;">Product Name</h3>
      <p style="font-size:14px; color:#555555; margin:0 0 10px 0;">Product description</p>
      <p style="font-size:16px; font-weight:bold; color:#B84A62; margin:0;">$65</p>
    </td>
  </tr>
</table>

Example 2: Image gallery (use COLUMNS with 3 columns):
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
  <tr>
    <td width="33.33%" valign="top" style="padding:5px;">
      <img src="gallery1.jpg" alt="Gallery 1" style="display:block; width:100%; height:auto;" />
    </td>
    <td width="33.33%" valign="top" style="padding:5px;">
      <img src="gallery2.jpg" alt="Gallery 2" style="display:block; width:100%; height:auto;" />
    </td>
    <td width="33.33%" valign="top" style="padding:5px;">
      <img src="gallery3.jpg" alt="Gallery 3" style="display:block; width:100%; height:auto;" />
    </td>
  </tr>
</table>

Example 3: Simple text content (separate blocks):
<p style="font-size:16px; color:#333333; margin:0 0 20px 0;">Welcome to our store!</p>
<h1 style="font-size:24px; color:#B84A62; margin:0 0 20px 0;">Every moment deserves to bloom</h1>
<p style="font-size:14px; color:#555555; margin:0 0 20px 0;">Discover our beautiful floral arrangements.</p>

Example 4: Button (standalone):
<a href="#" style="background-color:#B84A62; color:#FFFFFF; padding:12px 24px; border-radius:5px; text-decoration:none; display:inline-block;">Shop Now</a>

❌ WRONG STRUCTURES (will become rawHtml - DO NOT USE):

Wrong 1: Complex nested tables (TOO COMPLEX):
<table>
  <tr>
    <td>
      <table>
        <tr>
          <td width="200" valign="top">
            <table>
              <tr><td><img src="..." /></td></tr>
            </table>
          </td>
          <td valign="top">
            <table>
              <tr><td><h3>Title</h3></td></tr>
              <tr><td><p>Description</p></td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
→ This is TOO nested. Use simple COLUMNS structure instead (see Example 1 above).

Wrong 2: Multiple elements in one cell without structure:
<td>
  <img src="..." />
  <h3>Title</h3>
  <p>Description</p>
  <p>Price</p>
</td>
→ This mixes elements. Use COLUMNS block to separate image and text into different columns.

Wrong 3: Custom div structures:
<div style="display:flex; ...">
  <div>...</div>
  <div>...</div>
</div>
→ DO NOT use flexbox or custom div layouts. Use COLUMNS table structure instead.

URL HANDLING - CRITICAL:
- If organization website URL is provided in context, use it for all buttons and links
- If website URL is NOT available, use placeholder "#" for href attributes
- DO NOT use "https://example.com" or other fake URLs
- For unsubscribe links, use "#unsubscribe" placeholder if real URL not available
- For email links, use "mailto:" format if email is provided in context
- All URLs should be either real organization URLs or placeholders that can be detected and filled later

TYPOGRAPHY HIERARCHY - CRITICAL:
- Use proper heading hierarchy: h1 (24-32px) for main titles, h2 (20-24px) for section titles, h3 (18-20px) for subsections
- Body text should be 14-16px, never smaller than 12px
- Use font-weight to create hierarchy: 700 for h1, 600 for h2, 500 for emphasis, 400 for body
- Line height: 1.2-1.3 for headings, 1.5-1.6 for body text
- Create clear visual hierarchy through size, weight, and spacing differences
- Headings should be noticeably larger than body text (at least 4-6px difference)

KEY RULES - FOLLOW THESE EXACTLY:
1. Each block type must be a SIMPLE, PARSEABLE structure.
2. Use COLUMNS blocks (simple table with <td> elements) for ANY side-by-side layouts:
   - Products (image + text)
   - Image galleries
   - Feature lists
   - Any content that needs to be side-by-side
3. Use CONTAINER blocks to group related blocks and control nested layout (vertical/horizontal).
4. Columns and containers may contain nested blocks, but keep nesting depth to max 3 levels total.
5. Each text element = separate <p> or <h1>-<h6> tag (one tag = one text block)
6. Each image = separate <img> tag (one tag = one image block)
7. Each button = separate <a> tag with button styling (background-color + padding)
8. ${generateCustomHtml ? "You may use minimal custom HTML, but prefer standard blocks." : "🚫🚫🚫 ABSOLUTELY NO custom HTML - only use the block types listed above. If you generate custom HTML, the template will be uneditable in the visual builder. This is CRITICAL. 🚫🚫🚫"}
9. For products: Use COLUMNS block with image in one column, text in another
10. LOGO SIZING: Logos MUST have max-width: 120-160px, width:auto, height:auto, and max-height:80px to prevent oversized headers. Never let logos take more than 20% of email height. Header padding should be reasonable (20-32px).
11. For galleries: Use COLUMNS block with multiple <td> elements, each containing one <img>
12. Keep structure clear: outer wrapper table -> section rows -> standard blocks/containers/columns
13. DISTRIBUTE content across sections: header blocks in header, body blocks in body, footer blocks in footer
14. DO NOT put everything in one section - use proper section distribution
15. If dynamic placeholders are used, only use allowed placeholder keys from the Dynamic Source Contract.

COMPLETE TEMPLATE STRUCTURE EXAMPLE (follow this pattern exactly):

<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email Template</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f4f2;">
  <!-- Preheader (hidden) -->
  <div style="display:none; font-size:1px; color:#f7f4f2; line-height:1px; max-height:0px; opacity:0; overflow:hidden;">
    Preview text here
  </div>
  
  <!-- Main wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <!-- Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px; background-color:#ffffff;">
          
          <!-- HEADER: Logo (one row, one block) -->
          <tr>
            <td align="center" style="padding:20px 32px 12px 32px;">
              <a href="#"><img src="logo.jpg" alt="Logo" style="display:block; max-width:160px; width:auto; height:auto; max-height:80px;" /></a>
            </td>
          </tr>
          
          <!-- BODY: Heading (one row, one text block) -->
          <tr>
            <td style="padding:24px 28px 12px 28px;">
              <h1 style="font-size:24px; color:#B84A62; margin:0 0 20px 0;">Welcome!</h1>
            </td>
          </tr>
          
          <!-- BODY: Description (one row, one text block) -->
          <tr>
            <td style="padding:0 28px 12px 28px;">
              <p style="font-size:16px; color:#333333; margin:0 0 20px 0;">Description text here</p>
            </td>
          </tr>
          
          <!-- BODY: Feature showcase using COLUMNS (example - only include if user requests features) -->
          <!-- NOTE: Products should ONLY be included if user explicitly requests them in their prompt -->
          <!-- For most emails (newsletter, transactional, welcome), focus on content, not products -->
          
          <!-- BODY: Gallery using COLUMNS (one row, one columns block with 3 columns) - only if user requests -->
          <tr>
            <td style="padding:12px 28px 12px 28px;">
              <h2 style="font-size:20px; color:#B84A62; margin:0 0 15px 0; text-align:center;">Our Gallery</h2>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 12px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="33.33%" valign="top" style="padding:5px;">
                    <img src="gallery1.jpg" alt="Gallery 1" style="display:block; width:100%; height:auto;" />
                  </td>
                  <td width="33.33%" valign="top" style="padding:5px;">
                    <img src="gallery2.jpg" alt="Gallery 2" style="display:block; width:100%; height:auto;" />
                  </td>
                  <td width="33.33%" valign="top" style="padding:5px;">
                    <img src="gallery3.jpg" alt="Gallery 3" style="display:block; width:100%; height:auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- BODY: Button (one row, one button block) -->
          <tr>
            <td style="padding:12px 28px 12px 28px; text-align:center;">
              <a href="#" style="background-color:#B84A62; color:#FFFFFF; padding:12px 24px; border-radius:5px; text-decoration:none; display:inline-block;">Shop Now</a>
            </td>
          </tr>
          
          <!-- FOOTER: Contact info (one row, one text block) -->
          <tr>
            <td style="padding:18px 24px 24px 24px; background-color:#f5f1ee; text-align:center;">
              <p style="font-size:12px; color:#777777; margin:0 0 4px 0;">Company Name</p>
              <p style="font-size:12px; color:#777777; margin:0 0 4px 0;">Address, City, Country</p>
              <p style="font-size:12px; color:#777777; margin:0;">
                <a href="mailto:email@example.com" style="color:#777777;">email@example.com</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>

KEY POINTS FROM THIS EXAMPLE:
- Each content element is in its own <tr><td> row
- Content is distributed across header, body, and footer sections
- Header has logo (1 block)
- Body has main content (text, images, buttons)
- Footer has contact info and unsubscribe (2-3 blocks)
- Gallery uses COLUMNS block (simple table with 3 <td> elements) - only if user requests
- Each text element is separate
- Each image is separate
- NO complex nesting - maximum 2 levels (outer table → columns table)
- Simple, flat structure that the parser can understand
- Products are NOT shown in this example - only include if user explicitly requests them

Email Template Structure:
1. HTML DOCTYPE and proper structure
2. Head section with meta tags, viewport, and embedded styles
3. Body with table-based layout (for email client compatibility)
4. Preheader text (hidden, for email preview)
5. Main container table (max-width: 600px, centered)
6. Header section (if targetSection is "full" or "header")
7. Body section (if targetSection is "full" or "body")
8. Footer section (if targetSection is "full" or "footer")

Email HTML Best Practices:
- Use <table> elements for layout (email clients don't support modern CSS layouts well)
- All styles must be inline (style="...")
- Use web-safe fonts: Arial, Helvetica, Georgia, Times New Roman, or system fonts
- Provide alt text for all images
- Use role="presentation" for layout tables
- Set cellpadding="0" cellspacing="0" border="0" on tables
- Use <td> elements with padding for spacing (not margins)
- Avoid CSS Grid, Flexbox, or modern CSS features
- Test that images have proper width constraints (max-width: 100%)
- Use background-color on <td> elements for colored sections
- Ensure text has sufficient contrast (WCAG AA minimum)

SECTION-SPECIFIC BLOCK TYPES (CRITICAL - USE CORRECT BLOCKS FOR EACH SECTION):

HEADER SECTION (section="header"):
- logo: Organization logo (REQUIRED if logo is available)
- subject: Email subject line (optional, typically handled separately)
- preheader: Preview text (optional, typically handled separately)
- navigation: Navigation links (optional)
- text: Header text, tagline, or announcement (optional)
- divider: Visual separator (optional)
- spacer: Spacing element (optional)
- image: Hero image or header image (optional)
DO NOT put body content (products, main text, buttons) in header section.

BODY SECTION (section="body"):
- text: Paragraphs, headings, descriptions
- image: Product images, content images
- button: Call-to-action buttons
- divider: Visual separators
- spacer: Spacing elements
- columns: Multi-column layouts (products, features, galleries)
- container: Grouped content containers
- rawHtml: Custom HTML (only if generateCustomHtml is true)
DO NOT put header-specific blocks (logo, navigation) or footer-specific blocks in body section.

FOOTER SECTION (section="footer"):
- footerText: Contact information, address, copyright text
- socialLinks: Social media links
- unsubscribe: Unsubscribe link (REQUIRED for marketing emails)
- text: Footer text content
- divider: Visual separator (optional)
- spacer: Spacing element (optional)
DO NOT put header or body content in footer section.

${targetSection === "header" ? `
HEADER SECTION REQUIREMENTS:
- MUST include logo block if organization logo is available
- Can include navigation block for menu links
- Can include text block for tagline or announcement
- Keep it simple and professional
- Height should be reasonable (100-150px typical)
- DO NOT put body content here
` : ""}

${targetSection === "body" ? `
BODY SECTION REQUIREMENTS:
- Main content area with products, features, descriptions
- Use text blocks for headings and paragraphs
- Use image blocks for product images
- Use button blocks for call-to-action buttons
- Use columns blocks for side-by-side layouts (products, galleries)
- Use proper spacing and typography hierarchy
- Make it engaging and readable
- DO NOT put header or footer blocks here
` : ""}

${targetSection === "footer" ? `
FOOTER SECTION REQUIREMENTS:
- MUST include unsubscribe block (required for marketing emails)
- Include footerText blocks for contact information, address
- Include socialLinks block if organization has social media
- Include copyright/legal text in footerText blocks
- Professional footer design
- DO NOT put header or body content here
` : ""}

${targetSection === "full" ? `
FULL TEMPLATE REQUIREMENTS - DISTRIBUTE CONTENT ACROSS SECTIONS:

🚨 CRITICAL SECTION DISTRIBUTION RULES 🚨
You MUST distribute content across ALL THREE sections. DO NOT put everything in one section.

1. HEADER SECTION (section="header") - REQUIRED:
   - Logo block (if available) - MUST be in header
   - Navigation block (optional) - for menu links
   - Text block for tagline/announcement (optional)
   - Subject/preheader blocks (if applicable)
   - Keep header simple, professional, and focused
   - Header should be 1-3 blocks maximum
   - DO NOT put main content, products, or body text in header

2. BODY SECTION (section="body") - REQUIRED:
   - Main content: text blocks for headings and paragraphs
   - Hero images or content images
   - Call-to-action buttons
   - Product showcases (ONLY if user requested products or email type is product-focused)
   - Image galleries (ONLY if user requested)
   - Feature lists, testimonials, etc.
   - This is where MOST of your content should go
   - Body should have 3-10 blocks typically
   - DO NOT put header or footer content in body

3. FOOTER SECTION (section="footer") - REQUIRED:
   - footerText blocks for contact information (address, email, phone)
   - socialLinks block (if organization has social media)
   - unsubscribe block (REQUIRED for marketing emails)
   - Copyright/legal text in footerText blocks
   - Footer should be 2-4 blocks typically
   - DO NOT put main content, products, or body text in footer

HTML STRUCTURE FOR SECTIONS:
When generating HTML, structure it like this:
- Outer wrapper table
- Header section: <tr><td> with header blocks (logo, navigation, etc.)
- Body section: <tr><td> with body blocks (text, images, buttons, etc.)
- Footer section: <tr><td> with footer blocks (footerText, socialLinks, unsubscribe)

Each section should be in separate <tr><td> rows. DO NOT wrap everything in one container.

EXAMPLE DISTRIBUTION:
- Header: Logo + Navigation (2 blocks)
- Body: Heading + Description + Image + Button + Product showcase (5 blocks)
- Footer: Contact info + Social links + Unsubscribe (3 blocks)

Total: 10 blocks distributed across 3 sections - NOT all in one section!
` : ""}

${generateCustomHtml ? `
CUSTOM HTML MODE:
- You may include custom HTML blocks that cannot be represented as standard visual blocks
- These should be wrapped in comments: <!-- custom-html-block-start --> ... <!-- custom-html-block-end -->
- Custom HTML should still follow email client compatibility rules
` : ""}

${options?.customPrompt ? `\n\nADDITIONAL USER INSTRUCTIONS:\n${options.customPrompt}\n\nPlease incorporate these specific requirements into the template design while maintaining email client compatibility and professional appearance.` : ""}

🚨 PRODUCT INCLUSION RULES 🚨
${options?.context?.products && options.context.products.length > 0 ? `
Products are available in context, but:
- DO NOT include products unless the user explicitly requests them in their prompt
- DO NOT include products in standard email types (newsletter, transactional, welcome, etc.)
- ONLY include products if:
  1. User explicitly says "include products", "show products", "product catalog", "feature products", etc., OR
  2. The email type is clearly product-focused (product announcement, new product launch, catalog email, etc.)
- For most emails, focus on content, announcements, updates, and calls-to-action
- Products are for context/knowledge only - not required in every email
- If user says "newsletter", "welcome email", "transactional", "update", etc. - DO NOT include products
` : ""}

Design Quality:
- Professional appearance appropriate for ${style} style
- Clear visual hierarchy
- Proper spacing and alignment
- Engaging and readable content
- Mobile-friendly (responsive where possible)
- Accessible (proper alt text, contrast, semantic HTML)

Generate a complete HTML email template that is:
1. Fully compatible with major email clients (Gmail, Outlook, Apple Mail)
2. Uses table-based layouts for structure
3. Has all styles inline
4. Includes proper structure (header, body, footer if full template)
5. Uses only provided images or CSS-based design
6. Follows email HTML best practices
7. ${generateCustomHtml ? "May include minimal custom HTML for truly custom elements." : "MUST use ONLY the standard block types (text, image, button, divider, columns, logo) - NO custom HTML."}
8. Each content element is a simple, parseable block that maps to visual builder blocks
9. Uses COLUMNS blocks for side-by-side layouts (products, galleries, features)
10. Is ready to be sent via email

${generateCustomHtml ? "" : "🚫 REMINDER: generateCustomHtml is FALSE. You MUST generate HTML using ONLY standard block types. Any custom HTML will cause the template to be uneditable in the visual builder. This is CRITICAL."}

Return a JSON object with:
- name: Template name
- description: Brief description
- subject: Email subject line
- preheader: Preview text (optional)
- htmlContent: Complete HTML email code (using ONLY standard block types)
- blocks: A structured object with THREE sections:
  {
    "header": [/* array of blocks for header section */],
    "body": [/* array of blocks for body section */],
    "footer": [/* array of blocks for footer section */]
  }
  Each block must have: id (string), type (string), section (string: "header"|"body"|"footer"), and type-specific properties
- placeholders: Array of dynamic placeholder definitions actually used in content
- designTokens: Design token values used

🚨 CRITICAL: The blocks object MUST have all three sections (header, body, footer) with blocks properly distributed.
DO NOT put all blocks in one section. Distribute them across all three sections.

${generateCustomHtml ? "" : `
🚫🚫🚫 FINAL VALIDATION CHECKLIST BEFORE GENERATING HTML 🚫🚫🚫
Before you generate the htmlContent, verify:
1. ✅ Are you using ONLY text, image, button, divider, columns, logo blocks?
2. ✅ Have you distributed content across header, body, and footer sections?
3. ✅ Is header content in header section (logo, navigation)?
4. ✅ Is main content in body section (text, images, buttons)?
5. ✅ Is footer content in footer section (contact info, unsubscribe)?
6. ✅ ${options?.context?.products && options.context.products.length > 0 ? "Have you ONLY included products if the user explicitly requested them?" : "N/A - No products in context"}
7. ✅ Are galleries using COLUMNS blocks (simple multi-column table)?
8. ✅ Is each text element in its own <p> or <h1>-<h6> tag?
9. ✅ Is each image in its own <img> tag (or in a columns block)?
10. ✅ Is each button a standalone <a> tag with button styling?
11. ✅ Is the structure FLAT (max 2 nesting levels)?
12. ✅ Are you following the COMPLETE TEMPLATE STRUCTURE EXAMPLE above?
13. ✅ Are you avoiding complex nested tables?
14. ✅ Are you avoiding custom HTML structures?

If you answered NO to any of these, STOP and regenerate with the correct structure.
The htmlContent MUST be parseable into visual blocks, NOT a single rawHtml block.
The content MUST be distributed across sections, NOT all in one section.
🚫🚫🚫`}

The htmlContent must be a complete, valid HTML email that can be sent immediately AND parsed into visual builder blocks. If the HTML cannot be parsed into visual blocks, it will become a single uneditable rawHtml block, which breaks the user experience.

🚨 CRITICAL BLOCKS STRUCTURE REQUIREMENT 🚨
You MUST return blocks in a structured format with THREE sections:
{
  "header": [
    { "id": "block-header-1", "type": "logo", "section": "header", "src": "...", "alt": "Logo" },
    { "id": "block-header-2", "type": "navigation", "section": "header", "links": [...] }
  ],
  "body": [
    { "id": "block-body-1", "type": "text", "section": "body", "content": "Welcome!", ... },
    { "id": "block-body-2", "type": "image", "section": "body", "src": "...", "alt": "..." },
    { "id": "block-body-3", "type": "button", "section": "body", "label": "Shop Now", "url": "#", ... }
  ],
  "footer": [
    { "id": "block-footer-1", "type": "footerText", "section": "footer", "content": "Contact info", ... },
    { "id": "block-footer-2", "type": "unsubscribe", "section": "footer", "text": "Unsubscribe", "url": "#unsubscribe", ... }
  ]
}

Each block MUST have:
- id: unique string identifier (e.g., "block-header-1", "block-body-1")
- type: one of "text", "image", "button", "divider", "logo", "navigation", "footerText", "socialLinks", "unsubscribe", "columns", "container", "spacer"
- section: "header", "body", or "footer" (must match the section it's in)
- Type-specific properties:
  - text: { content: string, align?: "left"|"center"|"right", typography?: {...}, ... }
  - image: { src: string, alt?: string, width?: number, align?: "left"|"center"|"right", ... }
  - button: { label: string, url: string, variant?: "primary"|"secondary", align?: "left"|"center"|"right", ... }
  - logo: { src: string, alt?: string, width?: number, link?: string, ... }
  - navigation: { links: Array<{label: string, url: string}>, align?: "left"|"center"|"right", ... }
  - footerText: { content: string, align?: "left"|"center"|"right", ... }
  - unsubscribe: { text: string, url: string, align?: "left"|"center"|"right", ... }
  - columns: { columnCount: "2"|"3"|"4", columns: Array<{id: string, width: number, blocks: Array<...>}>, ... }
  - container: { maxWidth: 520|600|680|800, align: "left"|"center"|"right", layoutDirection: "vertical"|"horizontal", contentAlign: "left"|"center"|"right", justifyContent: "start"|"center"|"end"|"space-between", gap: number, padding: "none"|"xs"|"sm"|"md"|"lg", blocks: Array<...> }
  - divider: { style: "solid"|"dashed"|"dotted", color: string, width: number, ... }

DO NOT put all blocks in one section. You MUST distribute them:
- Header: logo, navigation, tagline (1-3 blocks typically)
- Body: main content, text, images, buttons (3-10 blocks typically)
- Footer: contact info, unsubscribe, social links (2-4 blocks typically)

The "placeholders" array rules:
- Include one entry for each distinct dynamic placeholder key actually used in subject, preheader, or htmlContent.
- Use only keys from the Dynamic Source Contract list when provided.
- Each placeholder should include source metadata:
  { "type": "entity_field", "entity": "...", "path": "...", "valueType": "..." }
- If no placeholders are used, return [].

This structured format ensures the visual builder can correctly display blocks in their proper sections.`;

    return prompt;
  }

  private getStyleDescription(style: string): string {
    const descriptions: Record<string, string> = {
      modern: "Clean, contemporary design with ample whitespace and modern typography",
      classic: "Traditional business email style with clear sections and formal appearance",
      minimal: "Minimalist design with focus on content and simplicity",
      professional: "Corporate-style email with structured layout and formal appearance",
      newsletter: "Newsletter-style with multiple sections, images, and engaging content",
      transactional: "Transaction-focused design with clear information hierarchy and call-to-action",
    };
    return descriptions[style] || descriptions.modern;
  }
}

// Export singleton instance
let emailTemplateGenerationServiceInstance: EmailTemplateGenerationService | null = null;

/**
 * Get or create the email template generation service instance
 */
export function getEmailTemplateGenerationService(): EmailTemplateGenerationService {
  if (!emailTemplateGenerationServiceInstance) {
    emailTemplateGenerationServiceInstance = new EmailTemplateGenerationService();
  }
  return emailTemplateGenerationServiceInstance;
}
