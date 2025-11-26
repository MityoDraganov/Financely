import { logger } from "firebase-functions";
import { AIService } from "./ai-service";
import { getAIService } from "./ai-service";
import { Organization } from "../../core/entities/organization";

/**
 * Email template data structure matching the frontend schema
 */
export interface EmailTemplateData {
  orgId: string;
  brandId?: string;
  name: string;
  description?: string;
  key?: string;
  subject: string;
  preheader?: string;
  status: "draft" | "published";
  version: number;
  isSystemDefault: boolean;
  isLocked: boolean;
  allowedContexts: string[];
  htmlContent: string;
  blocks: Array<any>;
  designTokens: {
    background: string;
    surface: string;
    text: string;
    primary: string;
    fontFamily: string;
    borderRadius: number;
  };
  sections?: {
    header: string[];
    body: string[];
    footer: string[];
  };
}

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
    options?: {
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
      generateCustomHtml?: boolean;
      targetSection?: "header" | "body" | "footer" | "full";
    }
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
      },
      required: ["name", "subject", "htmlContent", "designTokens"],
    };
    
    try {
      const result = await this.aiService.generateJSON<{
        name: string;
        description?: string;
        subject: string;
        preheader?: string;
        htmlContent: string;
        designTokens: {
          background: string;
          surface: string;
          text: string;
          primary: string;
          fontFamily: string;
          borderRadius: number;
        };
      }>(prompt, schema, {
        temperature: 0.7,
        maxTokens: 32768, // Large token limit for full HTML email content
      });
      
      // Parse HTML to blocks - only use rawHtml if generateCustomHtml is true
      // When generateCustomHtml is false, return empty blocks - frontend will parse HTML
      // When generateCustomHtml is true, create rawHtml block
      const blocks = options?.generateCustomHtml 
        ? this.parseHtmlToBlocksWithCustomHtml(result.htmlContent)
        : this.parseHtmlToBlocks(result.htmlContent);
      
      // Build sections from blocks (will be empty if blocks are empty, frontend will parse)
      const sections = this.buildSections(blocks);
      
      // Build template data
      const template: EmailTemplateData = {
        orgId: organization.id,
        name: result.name || "AI Generated Email Template",
        description: result.description,
        subject: result.subject,
        preheader: result.preheader,
        htmlContent: result.htmlContent,
        blocks,
        designTokens: result.designTokens || {
          background: "#ffffff",
          surface: "#f8fafc",
          text: "#0f172a",
          primary: organization.settings?.brandColors?.primary || "#2563eb",
          fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          borderRadius: 12,
        },
        status: "draft",
        version: 1,
        isSystemDefault: false,
        isLocked: false,
        allowedContexts: [],
        sections,
      };
      
      logger.info("Email template generated successfully", {
        organizationId: organization.id,
        templateName: template.name,
        blockCount: blocks.length,
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
    
    if (additionalContext?.products && additionalContext.products.length > 0) {
      parts.push(`\nProducts (${additionalContext.products.length}):`);
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
    options?: {
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
      generateCustomHtml?: boolean;
      targetSection?: "header" | "body" | "footer" | "full";
    }
  ): string {
    const style = options?.style || "modern";
    const targetSection = options?.targetSection || "full";
    const generateCustomHtml = options?.generateCustomHtml || false;
    
    const logoUrl = organization.settings?.branding?.customLogo || organization.logoUrl;
    const brandColors = organization.settings?.brandColors || {
      primary: "#2563eb",
      secondary: "#6b7280",
      accent: "#10b981",
    };
    
    let prompt = `You are a professional email template designer. Create a beautiful, functional, and email-client-compatible HTML email template.

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

${logoUrl ? `- Include organization logo: ${logoUrl}` : "- No logo available"}

Brand Colors:
- Primary: ${brandColors.primary}
- Secondary: ${brandColors.secondary}
- Accent: ${brandColors.accent}

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
    
    if (options?.context?.galleryImages && options.context.galleryImages.length > 0) {
      prompt += `\n- Available Gallery Images (you can use these in the template):`;
      options.context.galleryImages.slice(0, 10).forEach((url, idx) => {
        prompt += `\n  ${idx + 1}. ${url}`;
      });
      if (options.context.galleryImages.length > 10) {
        prompt += `\n  ... and ${options.context.galleryImages.length - 10} more`;
      }
    }
    
    prompt += `\n\n⚠️ REMEMBER: If an image is not in the list above, DO NOT use it. Use CSS colors/gradients instead or omit the image entirely.`;

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
   Example: <a href="#"><img src="logo.jpg" alt="Logo" style="display:block; max-width:160px; height:auto;" /></a>
   Rules: Simple logo image, typically in header.

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

KEY RULES - FOLLOW THESE EXACTLY:
1. Each block type must be a SIMPLE, FLAT HTML structure - NO deep nesting
2. Use COLUMNS blocks (simple table with <td> elements) for ANY side-by-side layouts:
   - Products (image + text)
   - Image galleries
   - Feature lists
   - Any content that needs to be side-by-side
3. Each text element = separate <p> or <h1>-<h6> tag (one tag = one text block)
4. Each image = separate <img> tag (one tag = one image block)
5. Each button = separate <a> tag with button styling (background-color + padding)
6. NO complex nesting - maximum 2 levels deep (outer table → inner table for columns)
7. ${generateCustomHtml ? "You may use minimal custom HTML, but prefer standard blocks." : "🚫🚫🚫 ABSOLUTELY NO custom HTML - only use the block types listed above. If you generate custom HTML, the template will be uneditable in the visual builder. This is CRITICAL. 🚫🚫🚫"}
8. For products: Use COLUMNS block with image in one column, text in another
9. For galleries: Use COLUMNS block with multiple <td> elements, each containing one <img>
10. Keep structure FLAT: outer wrapper table → section rows → simple content blocks

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
              <a href="#"><img src="logo.jpg" alt="Logo" style="display:block; max-width:160px; height:auto;" /></a>
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
          
          <!-- BODY: Product showcase using COLUMNS (one row, one columns block) -->
          <tr>
            <td style="padding:0 28px 12px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="50%" valign="top" style="padding-right:6px;">
                    <img src="product1.jpg" alt="Product 1" style="display:block; width:100%; height:auto;" />
                  </td>
                  <td width="50%" valign="top" style="padding-left:6px;">
                    <h3 style="font-size:18px; color:#B84A62; margin:0 0 10px 0;">Product Name</h3>
                    <p style="font-size:14px; color:#555555; margin:0 0 10px 0;">Product description</p>
                    <p style="font-size:16px; font-weight:bold; color:#B84A62; margin:0;">$65</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- BODY: Another product (repeat the columns structure) -->
          <tr>
            <td style="padding:12px 28px 12px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="50%" valign="top" style="padding-right:6px;">
                    <img src="product2.jpg" alt="Product 2" style="display:block; width:100%; height:auto;" />
                  </td>
                  <td width="50%" valign="top" style="padding-left:6px;">
                    <h3 style="font-size:18px; color:#B84A62; margin:0 0 10px 0;">Product Name 2</h3>
                    <p style="font-size:14px; color:#555555; margin:0 0 10px 0;">Product description 2</p>
                    <p style="font-size:16px; font-weight:bold; color:#B84A62; margin:0;">$120</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- BODY: Gallery using COLUMNS (one row, one columns block with 3 columns) -->
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
- Products use COLUMNS blocks (simple table with 2 <td> elements)
- Gallery uses COLUMNS block (simple table with 3 <td> elements)
- Each text element is separate
- Each image is separate
- NO complex nesting - maximum 2 levels (outer table → columns table)
- Simple, flat structure that the parser can understand

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

${targetSection === "header" ? `
HEADER SECTION REQUIREMENTS:
- Include logo if available
- Organization name
- Navigation or tagline
- Professional header design
- Height should be reasonable (100-150px typical)
` : ""}

${targetSection === "body" ? `
BODY SECTION REQUIREMENTS:
- Main content area
- Can include: text, images, buttons, product showcases, feature lists
- Use proper spacing and typography hierarchy
- Make it engaging and readable
` : ""}

${targetSection === "footer" ? `
FOOTER SECTION REQUIREMENTS:
- Contact information
- Social media links (if applicable)
- Unsubscribe link (required for marketing emails)
- Copyright/legal text
- Professional footer design
` : ""}

${generateCustomHtml ? `
CUSTOM HTML MODE:
- You may include custom HTML blocks that cannot be represented as standard visual blocks
- These should be wrapped in comments: <!-- custom-html-block-start --> ... <!-- custom-html-block-end -->
- Custom HTML should still follow email client compatibility rules
` : ""}

${options?.customPrompt ? `\n\nADDITIONAL USER INSTRUCTIONS:\n${options.customPrompt}\n\nPlease incorporate these specific requirements into the template design while maintaining email client compatibility and professional appearance.` : ""}

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
- designTokens: Design token values used

${generateCustomHtml ? "" : `
🚫🚫🚫 FINAL VALIDATION CHECKLIST BEFORE GENERATING HTML 🚫🚫🚫
Before you generate the htmlContent, verify:
1. ✅ Are you using ONLY text, image, button, divider, columns, logo blocks?
2. ✅ Are products using COLUMNS blocks (simple 2-column table)?
3. ✅ Are galleries using COLUMNS blocks (simple multi-column table)?
4. ✅ Is each text element in its own <p> or <h1>-<h6> tag?
5. ✅ Is each image in its own <img> tag (or in a columns block)?
6. ✅ Is each button a standalone <a> tag with button styling?
7. ✅ Is the structure FLAT (max 2 nesting levels)?
8. ✅ Are you following the COMPLETE TEMPLATE STRUCTURE EXAMPLE above?
9. ✅ Are you avoiding complex nested tables?
10. ✅ Are you avoiding custom HTML structures?

If you answered NO to any of these, STOP and regenerate with the correct structure.
The htmlContent MUST be parseable into visual blocks, NOT a single rawHtml block.
🚫🚫🚫`}

The htmlContent must be a complete, valid HTML email that can be sent immediately AND parsed into visual builder blocks. If the HTML cannot be parsed into visual blocks, it will become a single uneditable rawHtml block, which breaks the user experience.`;

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

  /**
   * Parse HTML to structured blocks
   * Returns empty array - the frontend's htmlToBlocks will parse the HTML properly
   * This ensures the AI generates proper HTML that can be parsed into visual blocks
   */
  private parseHtmlToBlocks(_html: string): Array<any> {
    // Return empty blocks - the frontend's htmlToBlocks will parse the HTML
    // This ensures we don't lose any content and the frontend can properly parse
    // structured blocks from the HTML using its robust parser
    return [];
  }

  /**
   * Parse HTML allowing custom HTML blocks (when generateCustomHtml is true)
   */
  private parseHtmlToBlocksWithCustomHtml(html: string): Array<any> {
    // When custom HTML is explicitly requested, create a single rawHtml block
    // The user explicitly wants custom HTML, so we preserve it as rawHtml
    return [
      {
        id: `block-${Date.now()}-custom`,
        type: "rawHtml",
        section: "body",
        html: html,
      },
    ];
  }

  /**
   * Build sections structure from blocks
   */
  private buildSections(blocks: Array<any>): { header: string[]; body: string[]; footer: string[] } {
    const sections = {
      header: [] as string[],
      body: [] as string[],
      footer: [] as string[],
    };
    
    blocks.forEach((block) => {
      const section = block.section || "body";
      if (section === "header") {
        sections.header.push(block.id);
      } else if (section === "footer") {
        sections.footer.push(block.id);
      } else {
        sections.body.push(block.id);
      }
    });
    
    return sections;
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

