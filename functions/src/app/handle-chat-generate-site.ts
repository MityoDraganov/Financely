import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getProductRepository } from "../repositories/product-repository";
import { GeminiService } from "../services/gemini-service";
import { FirebaseHostingService } from "../services/firebase-hosting-service";
import { injectNavigation, applyIntegrations } from "./handle-generate-site";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: string[];
}

interface ChatGenerateSiteInput {
  brandSiteId: string;
  message: string;
  attachments: string[];
  conversationHistory: ChatMessage[];
  conversationId: string;
}

interface ChatGenerateSiteConfig {
  geminiApiKey: string;
}

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
    // Use a timeout to prevent hanging
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for analysis

    try {
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
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        logger.warn("Clarification analysis timed out, defaulting to incremental");
      } else {
        throw fetchError;
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

export async function handleChatGenerateSite(
  input: ChatGenerateSiteInput,
  config: ChatGenerateSiteConfig,
): Promise<{ response: string; updated: boolean; requiresClarification: boolean }> {
  const startTime = Date.now();
  
  try {
    const databaseService = getDatabaseService();
    const brandSiteRepository = getBrandSiteRepository(databaseService);
    const organizationRepository = getOrganizationRepository(databaseService);
    const productRepository = getProductRepository(databaseService);

    // Get brand site
    const brandSite = await brandSiteRepository.get({ id: input.brandSiteId });
    if (!brandSite) {
      throw new Error("Brand site not found");
    }

    // Get organization
    const organization = await organizationRepository.get({
      id: brandSite.organizationId,
    });
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Get products for context
    const products = await productRepository.getAll({
      queryConstraints: [
        { field: "organizationId", operator: "==", value: brandSite.organizationId },
      ],
    });

    // Build conversation context
    const conversationContext = buildConversationContext(
      input.conversationHistory,
      input.message,
      input.attachments,
      brandSite,
      organization,
      products,
    );

    // Initialize Gemini
    const geminiService = new GeminiService({
      apiKey: config.geminiApiKey,
      model: "gemini-2.5-flash",
    });

    // Check if user wants to create a new page
    const lowerMessage = input.message.toLowerCase();
    const isPageCreationRequest = 
      lowerMessage.includes("create") && (lowerMessage.includes("page") || lowerMessage.includes("blog") || lowerMessage.includes("contact") || lowerMessage.includes("about")) ||
      lowerMessage.includes("build") && (lowerMessage.includes("page") || lowerMessage.includes("blog") || lowerMessage.includes("contact") || lowerMessage.includes("about")) ||
      lowerMessage.includes("add") && (lowerMessage.includes("page") || lowerMessage.includes("blog") || lowerMessage.includes("contact") || lowerMessage.includes("about")) ||
      lowerMessage.includes("new") && (lowerMessage.includes("page") || lowerMessage.includes("blog") || lowerMessage.includes("contact") || lowerMessage.includes("about"));

    // Detect page type from message
    let detectedPageType: "blog" | "contact" | "standard" | null = null;
    let detectedPageTitle: string | null = null;
    if (isPageCreationRequest) {
      if (lowerMessage.includes("blog")) {
        detectedPageType = "blog";
        detectedPageTitle = "Blog";
      } else if (lowerMessage.includes("contact")) {
        detectedPageType = "contact";
        detectedPageTitle = "Contact";
      } else if (lowerMessage.includes("about")) {
        detectedPageType = "standard";
        detectedPageTitle = "About";
      } else {
        // Generic page creation
        detectedPageType = "standard";
        detectedPageTitle = "New Page";
      }
    }

    // Determine if this is a full regeneration or incremental edit, and if clarification is needed
    const currentHtml = brandSite.html || "";
    const editAnalysis = await determineEditType(
      config.geminiApiKey,
      input.message,
      input.conversationHistory,
      currentHtml,
      conversationContext,
    );

    let response: string;
    let updatedHtml: string | undefined;
    let newPage: { slug: string; title: string; type: "blog" | "contact" | "standard" } | null = null;
    let requiresClarification = false;

    if (editAnalysis.editType === "clarification" && editAnalysis.clarificationQuestion) {
      // AI needs clarification - use the dynamically generated question
      response = editAnalysis.clarificationQuestion;
      requiresClarification = true;
    } else if (isPageCreationRequest && detectedPageType) {
      // Create a new page
      const pages = (brandSite.pages as any[]) || [];
      const existingSlugs = new Set(pages.map(p => p.slug));
      
      // Generate slug from page title
      let slug = detectedPageTitle!.toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      
      // Ensure slug is unique
      let finalSlug = slug;
      let counter = 1;
      while (existingSlugs.has(finalSlug)) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }

      // Create new page entry
      newPage = {
        slug: finalSlug,
        title: detectedPageTitle!,
        type: detectedPageType,
      };

      const brandColors = brandSite.brandColors || {
        primary: "#2563eb",
        secondary: "#64748b",
        accent: "#10b981",
      };

      // Generate HTML for the new page
      updatedHtml = await geminiService.generateSiteHtml({
        brandName: brandSite.brandName,
        colors: brandColors,
        logoUrl: brandSite.logoUrl,
        tone: brandSite.tone || "professional",
        description: brandSite.context,
        brandImages: brandSite.contextImages || [],
        context: `${brandSite.context || ""}\n\nUser request: ${input.message}`,
        contextImages: input.attachments.length > 0 ? input.attachments : brandSite.contextImages || [],
        products: products.map((p) => ({
          name: p.name,
          description: p.description,
          price: p.price,
          currency: p.currency,
          category: p.category,
          images: p.images,
        })),
        widgets: (brandSite as any).widgets,
        pageTitle: detectedPageTitle!,
        pagePurpose: input.message,
        pageSlug: finalSlug,
        pageType: detectedPageType,
      });

      response = `I've created a new ${detectedPageType} page called "${detectedPageTitle}"! It will be available at /${finalSlug}.`;
    } else if (editAnalysis.editType === "incremental" && currentHtml) {
      // Incremental edit - only modify requested parts
      const editResult = await performIncrementalEdit(
        geminiService,
        input.message,
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
        context: `${brandSite.context || ""}\n\nUser request: ${input.message}`,
        contextImages: input.attachments.length > 0 ? input.attachments : brandSite.contextImages || [],
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
      const pages = (brandSite.pages as any[]) || [];
      let updatedPages = [...pages];
      let pageHtml = updatedHtml;
      let deployPath = "/index.html";

      // If creating a new page, add it to pages array
      if (newPage) {
        const pageId = `page-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const newPageEntry = {
          id: pageId,
          title: newPage.title,
          slug: newPage.slug,
          type: newPage.type,
          order: pages.length, // Add at the end
          description: `Created via chat: ${input.message}`,
          contentEntries: [],
        };
        updatedPages = [...pages, newPageEntry];
        
        // Deploy to the new page path
        deployPath = `/${newPage.slug}/index.html`;
        
        // Inject navigation with the new page included
        pageHtml = injectNavigation(updatedHtml, updatedPages, newPage.slug, brandSite.brandName);
        
        // Update pages array in Firestore
        await brandSiteRepository.update({
          id: input.brandSiteId,
          data: {
            pages: updatedPages,
          } as any,
        });
      } else {
        // Regular update - inject navigation if pages exist
        if (pages.length > 0) {
          // Determine current page slug (default to "index" for main page updates)
          const currentSlug = "index";
          pageHtml = injectNavigation(updatedHtml, pages, currentSlug, brandSite.brandName);
        }
      }

      // Apply integrations (widgets, analytics)
      pageHtml = applyIntegrations(pageHtml, {
        widgets: (brandSite as any).widgets,
        organizationId: organization.id,
        brandSiteId: input.brandSiteId,
        firebaseProjectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "",
        tempSiteId: `brand-${input.brandSiteId}`,
        brandName: brandSite.brandName,
      });

      // If creating a new page, store it separately; otherwise update main HTML
      if (newPage) {
        // Store the new page HTML in a pages map (we'll need to extend the schema or use files)
        // For now, we'll deploy it and store reference in metadata
        await brandSiteRepository.update({
          id: input.brandSiteId,
          data: {
            status: "deploying",
            // Store page HTML in files map for now (we can improve this later)
            files: {
              ...((brandSite.files as Record<string, string>) || {}),
              [`${newPage.slug}/index.html`]: pageHtml,
            },
          } as any,
        });
      } else {
        // Update main HTML
        await brandSiteRepository.update({
          id: input.brandSiteId,
          data: {
            html: pageHtml,
            status: "deploying",
          },
        });
      }

      response += "\n\n✅ Site has been updated! Deploying to hosting...";

      // Deploy to Firebase Hosting asynchronously
      const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
      const hostingService = new FirebaseHostingService({ projectId });
      const siteId = `brand-${input.brandSiteId}`;
      
      // Start deployment in background
      (async () => {
        try {
          // Ensure site exists
          try {
            await hostingService.createSite(siteId);
            logger.info("Created new hosting site", { siteId });
          } catch (error) {
            // Site might already exist, which is fine
            logger.info("Site may already exist, continuing with deployment", { siteId });
          }
          
          const filesToDeploy: Array<{ path: string; contents: string }> = [];
          
          if (newPage) {
            // Deploy the new page
            filesToDeploy.push({ path: deployPath, contents: pageHtml });
            
            // Also regenerate and deploy index.html with updated navigation
            if (brandSite.html) {
              const updatedIndexHtml = injectNavigation(
                brandSite.html,
                updatedPages,
                "index",
                brandSite.brandName
              );
              const indexWithIntegrations = applyIntegrations(updatedIndexHtml, {
                widgets: (brandSite as any).widgets,
                organizationId: organization.id,
                brandSiteId: input.brandSiteId,
                firebaseProjectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "",
                tempSiteId: `brand-${input.brandSiteId}`,
                brandName: brandSite.brandName,
              });
              filesToDeploy.push({ path: "/index.html", contents: indexWithIntegrations });
              
              // Update main HTML in Firestore
              await brandSiteRepository.update({
                id: input.brandSiteId,
                data: {
                  html: indexWithIntegrations,
                },
              });
            }
          } else {
            // Regular update - deploy main page
            filesToDeploy.push({ path: "/index.html", contents: pageHtml });
          }

          const deployedUrl = await hostingService.deploySite(siteId, filesToDeploy);

          // Update brand site document with final status and deployed URL
          await brandSiteRepository.update({
            id: input.brandSiteId,
            data: {
              status: "success",
              deployedUrl: deployedUrl || `https://${siteId}.web.app`,
            },
          });

          logger.info("Site deployed successfully in background", {
            brandSiteId: input.brandSiteId,
            deployedUrl: deployedUrl || `https://${siteId}.web.app`,
            newPage: newPage ? newPage.slug : null,
          });
        } catch (deployError) {
          logger.error("Background deployment failed", {
            brandSiteId: input.brandSiteId,
            error: deployError instanceof Error ? deployError.message : "Unknown error",
          });
          
          // Update status to failed
          await brandSiteRepository.update({
            id: input.brandSiteId,
            data: {
              status: "failed",
            },
          });
        }
      })();
    }

    logger.info("Chat generation completed", {
      brandSiteId: input.brandSiteId,
      editType: editAnalysis.editType,
      requiresClarification,
      durationMs: Date.now() - startTime,
      updated: !!updatedHtml,
    });

    return {
      response,
      updated: !!updatedHtml,
      requiresClarification,
    };
  } catch (error) {
    logger.error("Chat generation failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      brandSiteId: input.brandSiteId,
    });
    throw error;
  }
}

