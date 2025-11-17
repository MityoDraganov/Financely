import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getProductRepository } from "../repositories/product-repository";
import { GeminiService } from "../services/gemini-service";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { logger } from "firebase-functions";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
}

interface ChatGenerateSitePayload {
  brandSiteId: string;
  message: string;
  attachments?: string[];
  conversationHistory?: ChatMessage[];
}

/**
 * Chat-based site generation function.
 * Supports multi-turn conversations, incremental editing, and photo attachments.
 */
export const chatGenerateSite = onCall<ChatGenerateSitePayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 300, // 5 minutes for AI processing
    memory: "512MiB",
    secrets: [geminiApiKey],
  },
  async (request) => {
    const startTime = Date.now();
    try {
      const { brandSiteId, message, attachments = [], conversationHistory = [] } = request.data;

      if (!brandSiteId) {
        throw new HttpsError("invalid-argument", "brandSiteId is required");
      }

      if (!message || !message.trim()) {
        throw new HttpsError("invalid-argument", "message is required");
      }

      logger.info("Chat-based site generation", {
        brandSiteId,
        messageLength: message.length,
        attachmentCount: attachments.length,
        historyLength: conversationHistory.length,
      });

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);
      const organizationRepository = getOrganizationRepository(databaseService);
      const productRepository = getProductRepository(databaseService);

      // Get brand site
      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError("not-found", "Brand site not found");
      }

      // Get organization
      const organization = await organizationRepository.get({
        id: brandSite.organizationId,
      });
      if (!organization) {
        throw new HttpsError("not-found", "Organization not found");
      }

      // Get products for context
      const products = await productRepository.getAll({
        queryConstraints: [
          { field: "organizationId", operator: "==", value: brandSite.organizationId },
        ],
      });

      // Build conversation context
      const conversationContext = buildConversationContext(
        conversationHistory,
        message,
        attachments,
        brandSite,
        organization,
        products,
      );

      // Initialize Gemini
      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        throw new HttpsError("internal", "Gemini API key not configured");
      }

      const geminiService = new GeminiService({
        apiKey,
        model: "gemini-2.5-flash",
      });

      // Determine if this is a full regeneration or incremental edit, and if clarification is needed
      const currentHtml = brandSite.html || "";
      const editAnalysis = await determineEditType(
        apiKey,
        message,
        conversationHistory,
        currentHtml,
        conversationContext,
      );

      let response: string;
      let updatedHtml: string | undefined;
      let requiresClarification = false;

      if (editAnalysis.editType === "clarification" && editAnalysis.clarificationQuestion) {
        // AI needs clarification - use the dynamically generated question
        response = editAnalysis.clarificationQuestion;
        requiresClarification = true;
      } else if (editAnalysis.editType === "incremental" && currentHtml) {
        // Incremental edit - only modify requested parts
        const editResult = await performIncrementalEdit(
          geminiService,
          message,
          currentHtml,
          conversationContext,
          brandSite,
        );
        response = editResult.response;
        updatedHtml = editResult.updatedHtml;
      } else {
        // Full generation or first generation
        const brandColors = brandSite.brandColors || {
          primary: "#2563eb",
          secondary: "#64748b",
          accent: "#10b981",
        };

        updatedHtml = await geminiService.generateSiteHtml({
          brandName: brandSite.brandName,
          colors: brandColors,
          logoUrl: brandSite.logoUrl,
          tone: brandSite.tone || "professional",
          description: brandSite.context,
          brandImages: brandSite.contextImages || [],
          context: `${brandSite.context || ""}\n\nUser request: ${message}`,
          contextImages: attachments.length > 0 ? attachments : brandSite.contextImages || [],
          products: products.map((p) => ({
            name: p.name,
            description: p.description,
            price: p.price,
            currency: p.currency,
            category: p.category,
            images: p.images,
          })),
          widgets: (brandSite as any).widgets,
        });

        response = "I've generated your website! Check the preview to see the result.";
      }

      // Update brand site if HTML was generated
      if (updatedHtml) {
        // Inject navigation if needed
        const pages = (brandSite.pages as any[]) || [];
        if (pages.length > 0) {
          updatedHtml = injectNavigation(updatedHtml, pages, brandSite.brandName);
        }

        // Apply integrations (widgets, analytics)
        updatedHtml = applyIntegrations(updatedHtml, {
          widgets: (brandSite as any).widgets,
          organizationId: organization.id,
          brandSiteId,
          firebaseProjectId: process.env.GCLOUD_PROJECT || "",
          tempSiteId: `brand-${brandSiteId}`,
          brandName: brandSite.brandName,
        });

        // Deploy to Firebase Hosting
        const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
        const hostingService = new FirebaseHostingService({ projectId });
        const siteId = `brand-${brandSiteId}`;
        
        // Ensure site exists
        let createdSite;
        try {
          createdSite = await hostingService.createSite(siteId);
          logger.info("Created new hosting site", { siteId, siteName: createdSite.name });
        } catch (error) {
          // Site might already exist, which is fine
          logger.info("Site may already exist, continuing with deployment", { siteId });
        }
        
        const filesToDeploy: Array<{ path: string; contents: string }> = [
          { path: "/index.html", contents: updatedHtml },
        ];

        const deployedUrl = await hostingService.deploySite(siteId, filesToDeploy);

        // Update brand site document
        await brandSiteRepository.update({
          id: brandSiteId,
          data: {
            html: updatedHtml,
            status: "success",
            deployedUrl: deployedUrl || `https://${siteId}.web.app`,
          },
        });

        response += "\n\n✅ Site has been updated and deployed!";
      }

      logger.info("Chat generation completed", {
        brandSiteId,
        editType: editAnalysis.editType,
        requiresClarification,
        durationMs: Date.now() - startTime,
        updated: !!updatedHtml,
      });

      return {
        response,
        updated: !!updatedHtml,
        requiresClarification,
        brandSiteId,
      };
    } catch (error) {
      logger.error("Chat generation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to process chat request",
      );
    }
  },
);

function buildConversationContext(
  history: ChatMessage[],
  currentMessage: string,
  attachments: string[],
  brandSite: any,
  organization: any,
  products: any[],
): string {
  let context = `Brand: ${brandSite.brandName}\n`;
  context += `Organization: ${organization.name}\n`;
  if (brandSite.context) {
    context += `Context: ${brandSite.context}\n`;
  }
  if (products.length > 0) {
    context += `\nProducts:\n${products.map((p) => `- ${p.name}: ${p.price} ${p.currency}`).join("\n")}\n`;
  }
  if (attachments.length > 0) {
    context += `\nUser provided ${attachments.length} image(s) as reference.\n`;
  }
  if (history.length > 0) {
    context += `\nPrevious conversation:\n`;
    history.slice(-5).forEach((msg) => {
      context += `${msg.role}: ${msg.content}\n`;
    });
  }
  context += `\nCurrent request: ${currentMessage}`;
  return context;
}

/**
 * Use AI to determine if clarification is needed and what type of edit to perform
 */
async function determineEditType(
  apiKey: string,
  message: string,
  history: ChatMessage[],
  currentHtml: string,
  context: string,
): Promise<{ editType: "full" | "incremental" | "clarification"; clarificationQuestion?: string }> {
  const lowerMessage = message.toLowerCase();

  // Check if user explicitly wants full regeneration
  if (
    lowerMessage.includes("regenerate") ||
    lowerMessage.includes("start over") ||
    lowerMessage.includes("redo everything") ||
    lowerMessage.includes("completely rebuild") ||
    lowerMessage.includes("rebuild from scratch")
  ) {
    return { editType: "full" };
  }

  // Use AI to analyze if clarification is needed
  const clarificationPrompt = `You are analyzing a user's request to modify a website. Determine if the request is clear enough to proceed, or if clarification is needed.

Current website status: ${currentHtml ? "Website exists with content" : "No website exists yet"}
User's request: "${message}"

Previous conversation context:
${history.slice(-3).map(m => `${m.role}: ${m.content}`).join("\n")}

Brand context:
${context.substring(0, 500)}${context.length > 500 ? "..." : ""}

Analyze the request and respond with ONLY a JSON object in this exact format:
{
  "needsClarification": true/false,
  "editType": "full" | "incremental",
  "clarificationQuestion": "If needsClarification is true, provide a specific, helpful question asking for the missing information. If false, this field should be an empty string."
}

Rules:
- Set needsClarification to true ONLY if the request is genuinely ambiguous, vague, or missing critical information needed to proceed
- If the request is clear enough to make reasonable assumptions, set needsClarification to false
- The clarificationQuestion should be specific to what's missing (e.g., "Which section would you like me to update?" or "What specific color would you like for the header?")
- If needsClarification is false, clarificationQuestion must be an empty string
- editType should be "full" if regenerating entire site, "incremental" if modifying specific parts

Respond with ONLY the JSON object, no other text.`;

  try {
    // Make direct API call to Gemini for analysis (not HTML generation)
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: clarificationPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3, // Lower temperature for more consistent analysis
          topK: 20,
          topP: 0.8,
          maxOutputTokens: 500, // Small output for JSON analysis
          responseMimeType: "application/json",
        },
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        // Parse JSON response
        const analysis = JSON.parse(text);
        
        if (analysis.needsClarification === true && analysis.clarificationQuestion) {
          return {
            editType: "clarification",
            clarificationQuestion: analysis.clarificationQuestion,
          };
        }
        
        return {
          editType: analysis.editType || "incremental",
        };
      }
    }
  } catch (error) {
    logger.warn("Failed to analyze clarification needs, defaulting to incremental", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // Fallback: default to incremental if we have HTML, full if not
  return {
    editType: currentHtml ? "incremental" : "full",
  };
}

async function performIncrementalEdit(
  geminiService: GeminiService,
  message: string,
  currentHtml: string,
  context: string,
  brandSite: any,
): Promise<{ response: string; updatedHtml: string }> {
  // For now, we'll do a simple approach - full regeneration with context
  // TODO: Implement proper incremental editing with HTML parsing
  const brandColors = brandSite.brandColors || {
    primary: "#2563eb",
    secondary: "#64748b",
    accent: "#10b981",
  };

  const updatedHtml = await geminiService.generateSiteHtml({
    brandName: brandSite.brandName,
    colors: brandColors,
    logoUrl: brandSite.logoUrl,
    tone: brandSite.tone || "professional",
    description: brandSite.context,
    brandImages: brandSite.contextImages || [],
    context: `${brandSite.context || ""}\n\nUser wants to: ${message}\n\nPlease update the site accordingly, keeping the overall structure but making the requested changes.`,
    contextImages: [],
    products: [],
    widgets: brandSite.widgets,
  });

  return {
    response: "I've updated your site with the requested changes!",
    updatedHtml,
  };
}

function injectNavigation(html: string, pages: any[], brandName: string): string {
  // Simple navigation injection - reuse existing logic
  const navLinks = pages
    .map((page) => {
      const href = page.slug === "index" ? "/" : `/${page.slug}`;
      return `<a href="${href}" class="nav-link">${page.title}</a>`;
    })
    .join("");

  const nav = `
  <div class="site-nav-wrapper">
    <div class="site-nav">
      <a href="/" class="nav-brand">${brandName}</a>
      <nav class="nav-links">${navLinks}</nav>
    </div>
  </div>`;

  if (html.includes("<body")) {
    html = html.replace(/<body[^>]*>/, `$&\n${nav}`);
  } else {
    html = `${nav}\n${html}`;
  }

  return html;
}

function applyIntegrations(
  html: string,
  options: {
    widgets?: any;
    organizationId: string;
    brandSiteId: string;
    firebaseProjectId: string;
    tempSiteId: string;
    brandName: string;
  },
): string {
  // Simple integration injection
  if (options.widgets?.enabled) {
    const widgetScript = `<script src="/widget-loader.js"></script>`;
    if (html.includes("</body>")) {
      html = html.replace("</body>", `${widgetScript}\n</body>`);
    } else {
      html = `${html}\n${widgetScript}`;
    }
  }

  return html;
}

