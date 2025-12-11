import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getProductRepository } from "../repositories/product-repository";
import { getBrandContextService } from "../services/brand-context-service";
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
  conversationId: string | null; // Can be null - will be created if needed
  pageSlug?: string; // Optional: specify which page to edit
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
  allAvailableImages: string[],
  onStreamChunk?: (chunk: string, accumulated: string) => Promise<void>,
): Promise<{ response: string; updatedHtml: string }> {
  // For now, we'll do a simple approach - full regeneration with context
  // TODO: Implement proper incremental editing with HTML parsing
  const brandColors = brandSite.brandColors || {
    primary: "#2563eb",
    secondary: "#64748b",
    accent: "#10b981",
  };

  // Extract page title from current HTML if possible
  const titleMatch = currentHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : undefined;

  // Get available pages for linking validation
  const pages = (brandSite.pages as any[]) || [];
  const availablePages = pages.map((p) => ({
    slug: p.slug,
    title: p.title,
    href: p.slug === "index" || p.slug === "home" ? "/" : `/${p.slug}`,
  }));

  const updatedHtml = await geminiService.generateSiteHtml({
    brandName: brandSite.brandName,
    colors: brandColors,
    logoUrl: brandSite.logoUrl,
    tone: brandSite.tone || "professional",
    description: brandSite.context,
    brandImages: allAvailableImages, // Use all available images from storage
    context: `${context}\n\nCurrent page HTML (for reference - preserve structure and styling):\n${currentHtml.substring(0, 2000)}...\n\nUser wants to: ${message}\n\nPlease update ONLY this page accordingly, keeping the overall structure and styling but making the requested changes. Do NOT regenerate the entire page from scratch - make incremental edits.`,
    contextImages: allAvailableImages, // Use all available images from storage
    products: [],
    widgets: brandSite.widgets,
    pageTitle,
    availablePages,
  });

  return {
    response: "I've updated the page with the requested changes!",
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
    const firebaseProjectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    const brandContextService = getBrandContextService(
      organizationRepository,
      productRepository,
      firebaseProjectId,
    );

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

    // Get brand context (includes products and images)
    const brandContext = await brandContextService.getBrandContext(
      brandSite.organizationId,
      { includeImages: true, includeProducts: true },
    );
    const allAvailableImages = brandContext.brandImages;

    // Build conversation context
    const conversationContext = buildConversationContext(
      input.conversationHistory,
      input.message,
      input.attachments,
      brandSite,
      organization,
      brandContext.products,
    );

    // Ensure conversationId exists - create one if not provided
    let conversationId = input.conversationId;
    if (!conversationId) {
      conversationId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      logger.info("Created new conversationId", {
        brandSiteId: input.brandSiteId,
        conversationId,
      });
      
      // Create the conversation in Firestore if it doesn't exist
      const conversations = (brandSite.conversations as any[]) || [];
      const conversationExists = conversations.some((c: any) => c.id === conversationId);
      if (!conversationExists) {
        // Filter out undefined values from conversationHistory
        const cleanHistory = (input.conversationHistory || []).map((msg: any) => {
          const clean: any = {
            role: msg.role,
            content: msg.content,
          };
          if (msg.attachments && msg.attachments.length > 0) {
            clean.attachments = msg.attachments;
          }
          return clean;
        });
        
        const newConversation = {
          id: conversationId,
          title: input.message.substring(0, 50) || "New Conversation",
          messages: [
            ...cleanHistory,
            {
              id: `user-${Date.now()}`,
              role: "user" as const,
              content: input.message,
              ...(input.attachments && input.attachments.length > 0 && { attachments: input.attachments }),
              timestamp: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        await brandSiteRepository.update({
          id: input.brandSiteId,
          data: {
            conversations: [...conversations, newConversation],
          } as any,
        });
        
        logger.info("Created new conversation in Firestore", {
          brandSiteId: input.brandSiteId,
          conversationId,
          messageCount: newConversation.messages.length,
        });
      }
    }

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
    // If pageSlug is not provided, user wants to edit entire site
    const isEditingEntireSite = !input.pageSlug;
    
    // Get the HTML for the specific page being edited (or index if editing entire site)
    const targetPageSlug = input.pageSlug || "index";
    const existingFiles = (brandSite.files as Record<string, string>) || {};
    const currentHtml = targetPageSlug === "index" 
      ? (brandSite.html || "") 
      : (existingFiles[`${targetPageSlug}/index.html`] || "");
    
    const editAnalysis = await determineEditType(
      config.geminiApiKey,
      input.message,
      input.conversationHistory,
      currentHtml,
      conversationContext,
    );

    let response: string = "";
    let updatedHtml: string | undefined;
    let newPage: { slug: string; title: string; type: "blog" | "contact" | "standard" } | null = null;
    let requiresClarification = false;
    
    // Helper to update conversation in Firestore with streaming response
    // Uses throttling to avoid too many Firestore writes (max 1 update per 300ms)
    let lastStreamUpdate = 0;
    const STREAM_UPDATE_INTERVAL = 300; // Update every 300ms
    
    const updateConversationWithStream = async (
      accumulatedText: string,
      isComplete: boolean = false,
    ) => {
      const now = Date.now();
      
      // Always update on first chunk (when accumulatedText is first created)
      // Then throttle subsequent updates unless it's the final update
      const isFirstChunk = accumulatedText.length > 0 && lastStreamUpdate === 0;
      
      if (!isComplete && !isFirstChunk && now - lastStreamUpdate < STREAM_UPDATE_INTERVAL) {
        return;
      }
      
      lastStreamUpdate = now;
      
      try {
        const databaseService = getDatabaseService();
        const brandSiteRepository = getBrandSiteRepository(databaseService);
        const brandSite = await brandSiteRepository.get({ id: input.brandSiteId });
        if (!brandSite) {
          logger.warn("Brand site not found for streaming update", { brandSiteId: input.brandSiteId });
          return;
        }

        const conversations = (brandSite.conversations as any[]) || [];
        // Use the conversationId we ensured exists above
        if (!conversationId) {
          logger.error("CRITICAL: conversationId is null in updateConversationWithStream", {
            brandSiteId: input.brandSiteId,
            inputConversationId: input.conversationId,
          });
          return;
        }

        let conversationIndex = conversations.findIndex((c) => c.id === conversationId);
        if (conversationIndex < 0) {
          // Conversation doesn't exist yet - create it with the user message
          logger.info("Conversation not found for streaming update, creating it", {
            conversationId,
            availableConversationIds: conversations.map((c: any) => c.id),
            brandSiteId: input.brandSiteId,
          });
          
          // Filter out undefined values from conversationHistory
          const cleanHistory = (input.conversationHistory || []).map((msg: any) => {
            const clean: any = {
              role: msg.role,
              content: msg.content,
            };
            if (msg.attachments && msg.attachments.length > 0) {
              clean.attachments = msg.attachments;
            }
            return clean;
          });
          
          const userMessage: any = {
            id: `user-${Date.now()}`,
            role: "user" as const,
            content: input.message,
            timestamp: new Date().toISOString(),
          };
          if (input.attachments && input.attachments.length > 0) {
            userMessage.attachments = input.attachments;
          }
          
          const newConversation = {
            id: conversationId,
            title: input.message.substring(0, 50) || "New Conversation",
            messages: [
              ...cleanHistory,
              userMessage,
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          conversations.push(newConversation);
          conversationIndex = conversations.length - 1;
          
          // Save the new conversation first
          await brandSiteRepository.update({
            id: input.brandSiteId,
            data: {
              conversations: conversations,
            } as any,
          });
          
          logger.info("Created conversation for streaming", {
            conversationId,
            brandSiteId: input.brandSiteId,
            messageCount: newConversation.messages.length,
          });
        }

        const conversation = conversations[conversationIndex];
        const updatedConversations = [...conversations];
        
        // Find or create assistant message
        let assistantMessageIndex = conversation.messages.findIndex(
          (m: any) => m.role === "assistant" && m.id?.startsWith("assistant-streaming")
        );
        
        if (assistantMessageIndex < 0) {
          // Create new streaming message
          assistantMessageIndex = conversation.messages.length;
          conversation.messages.push({
            id: `assistant-streaming-${Date.now()}`,
            role: "assistant" as const,
            content: accumulatedText,
            timestamp: new Date().toISOString(),
          });
          logger.info("✅ Created streaming message", { 
            conversationId, 
            messageId: conversation.messages[assistantMessageIndex].id,
            contentLength: accumulatedText.length,
            preview: accumulatedText.substring(0, 100),
            brandSiteId: input.brandSiteId,
            totalMessages: conversation.messages.length,
          });
        } else {
          // Update existing streaming message
          conversation.messages[assistantMessageIndex] = {
            ...conversation.messages[assistantMessageIndex],
            content: accumulatedText,
            timestamp: new Date().toISOString(),
          };
          if (isFirstChunk || isComplete || accumulatedText.length % 100 === 0) {
            logger.info("🔄 Updated streaming message", { 
              conversationId, 
              messageId: conversation.messages[assistantMessageIndex].id,
              contentLength: accumulatedText.length,
              isComplete,
              preview: accumulatedText.substring(0, 50)
            });
          }
        }

        updatedConversations[conversationIndex] = {
          ...conversation,
          messages: conversation.messages,
          updatedAt: new Date().toISOString(),
        };

        await brandSiteRepository.update({
          id: input.brandSiteId,
          data: {
            conversations: updatedConversations,
          } as any,
        });
        
        logger.debug("✅ Successfully updated Firestore with streaming message", {
          conversationId,
          messageId: conversation.messages[assistantMessageIndex].id,
          contentLength: accumulatedText.length,
          brandSiteId: input.brandSiteId,
        });
      } catch (error) {
        logger.error("Failed to update conversation with stream", {
          error: error instanceof Error ? error.message : "Unknown error",
          brandSiteId: input.brandSiteId,
          conversationId: input.conversationId,
        });
      }
    };

    if (editAnalysis.editType === "clarification" && editAnalysis.clarificationQuestion) {
      // AI needs clarification - stream the dynamically generated question
      logger.info("Starting streaming for clarification question", { conversationId: input.conversationId });
      response = await geminiService.streamText(
        `You are a helpful AI website builder assistant. The user asked: "${input.message}". You need clarification. Respond with a friendly, concise question asking for the missing information. Be specific about what you need.`,
        async (chunk, accumulated) => {
          response = accumulated;
          await updateConversationWithStream(accumulated, false);
        }
      );
      logger.info("Streaming complete for clarification", { responseLength: response.length });
      await updateConversationWithStream(response, true);
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

      // Get available pages for linking validation (include the new page being created)
      const availablePages = [
        ...pages.map((p) => ({
          slug: p.slug,
          title: p.title,
          href: p.slug === "index" || p.slug === "home" ? "/" : `/${p.slug}`,
        })),
        {
          slug: finalSlug,
          title: detectedPageTitle!,
          href: `/${finalSlug}`,
        },
      ];

      // Generate HTML for the new page
      // Get brand context for AI with page-specific context
      const pageBrandContextForAI = await brandContextService.getBrandContextForAI(
        brandSite.organizationId,
        {
          context: `${brandSite.context || ""}\n\n🚨 CRITICAL: This is a NEW page being created. The user wants: ${input.message}\n\nMake this page visually DISTINCT and UNIQUE from other pages on the site. Each page needs a unique hero section featuring a relevant background (image or color), a clear page title, a subheadline, and primary/secondary call-to-action buttons. Center hero content within a max-width container and avoid placing extra logos inside the hero. Use a different layout structure, different hero style, and page-specific content that focuses on "${detectedPageTitle}". DO NOT repeat the same structure as other pages. Ensure the page is accessible at its correct URL path and has a clear visual identity.`,
          contextImages: input.attachments.length > 0 ? [...input.attachments, ...allAvailableImages] : allAvailableImages,
          pageTitle: detectedPageTitle!,
          pagePurpose: input.message,
          pageSlug: finalSlug,
          pageType: detectedPageType,
          availablePages,
        },
      );

      updatedHtml = await geminiService.generateSiteHtml({
        ...pageBrandContextForAI,
        brandName: brandSite.brandName,
        colors: brandColors,
        logoUrl: brandSite.logoUrl,
        tone: brandSite.tone || "professional",
      });

      // Stream response about page creation
      logger.info("Starting streaming for page creation response", { conversationId: input.conversationId });
      const pageCreationPrompt = `You are a helpful AI website builder. You just created a new ${detectedPageType} page called "${detectedPageTitle}" for the user. The page will be available at /${finalSlug}. Write a friendly, concise message (2-3 sentences) telling the user about this. Be enthusiastic but professional.`;
      response = await geminiService.streamText(
        pageCreationPrompt,
        async (chunk, accumulated) => {
          response = accumulated;
          await updateConversationWithStream(accumulated, false);
        }
      );
      logger.info("Streaming complete for page creation", { responseLength: response.length });
      await updateConversationWithStream(response, true);
    } else if (editAnalysis.editType === "incremental" && currentHtml) {
      // Incremental edit - only modify requested parts
      if (isEditingEntireSite) {
        // Editing entire site - regenerate all pages
        const pages = (brandSite.pages as any[]) || [];
        
        // Regenerate all pages with the requested changes
        const updatedPages: Array<{ slug: string; html: string }> = [];
        
        for (const page of pages) {
          const existingFiles = (brandSite.files as Record<string, string>) || {};
          const pageHtml = page.slug === "index" 
            ? (brandSite.html || "") 
            : (existingFiles[`${page.slug}/index.html`] || "");
          
          if (pageHtml) {
            const editResult = await performIncrementalEdit(
              geminiService,
              input.message,
              pageHtml,
              `${conversationContext}\n\nIMPORTANT: You are updating the "${page.slug}" page as part of a site-wide update. Apply the requested changes to this page while maintaining its unique identity and structure.`,
              brandSite,
              allAvailableImages,
            );
            updatedPages.push({ slug: page.slug, html: editResult.updatedHtml });
          }
        }
        
        // Store all updated pages
        const updatedFiles: Record<string, string> = {};
        let updatedMainHtml: string | undefined;
        
        for (const updatedPage of updatedPages) {
          if (updatedPage.slug === "index") {
            updatedMainHtml = updatedPage.html;
          } else {
            updatedFiles[`${updatedPage.slug}/index.html`] = updatedPage.html;
          }
        }
        
        // Update brand site with all pages
        const updateData: any = {
          status: "deploying",
        };
        
        if (updatedMainHtml) {
          updateData.html = updatedMainHtml;
        }
        
        if (Object.keys(updatedFiles).length > 0) {
          updateData.files = {
            ...((brandSite.files as Record<string, string>) || {}),
            ...updatedFiles,
          };
        }
        
        await brandSiteRepository.update({
          id: input.brandSiteId,
          data: updateData,
        });
        
        // Stream response about site-wide update
        logger.info("Starting streaming for site-wide update response", { conversationId: input.conversationId });
        const siteUpdatePrompt = `You are a helpful AI website builder. You just updated all pages across the user's website with their requested changes: "${input.message}". Write a friendly, concise message (2-3 sentences) confirming this. Mention that all pages are being deployed.`;
        response = await geminiService.streamText(
          siteUpdatePrompt,
          async (chunk, accumulated) => {
            response = accumulated;
            await updateConversationWithStream(accumulated, false);
          }
        );
        logger.info("Streaming complete for site-wide update", { responseLength: response.length });
        await updateConversationWithStream(response, true);
        updatedHtml = updatedMainHtml; // Set for deployment
      } else {
        // Editing specific page
        const targetPageSlug = input.pageSlug || "index";
        let pageHtmlToEdit = currentHtml;
        
        // If editing a specific page (not index), get that page's HTML
        if (targetPageSlug !== "index") {
          const existingFiles = (brandSite.files as Record<string, string>) || {};
          const pageFile = existingFiles[`${targetPageSlug}/index.html`];
          if (pageFile) {
            pageHtmlToEdit = pageFile;
          } else {
            // Page doesn't exist yet, create it
            response = `The page "${targetPageSlug}" doesn't exist yet. Would you like me to create it?`;
            requiresClarification = true;
            return { response, updated: false, requiresClarification };
          }
        }
        
        const editResult = await performIncrementalEdit(
          geminiService,
          input.message,
          pageHtmlToEdit,
          `${conversationContext}\n\nIMPORTANT: You are editing ONLY the "${targetPageSlug}" page. Do NOT modify other pages. Focus your changes on this specific page only.`,
          brandSite,
          allAvailableImages,
        );
        updatedHtml = editResult.updatedHtml;
        
        // Stream response about page update
        logger.info("Starting streaming for page update response", { conversationId: input.conversationId, pageSlug: targetPageSlug });
        const pageUpdatePrompt = `You are a helpful AI website builder. You just updated the "${targetPageSlug}" page based on the user's request: "${input.message}". Write a friendly, concise message (2-3 sentences) confirming the update. Mention that the page is being deployed.`;
        response = await geminiService.streamText(
          pageUpdatePrompt,
          async (chunk, accumulated) => {
            response = accumulated;
            await updateConversationWithStream(accumulated, false);
          }
        );
        logger.info("Streaming complete for page update", { responseLength: response.length });
        await updateConversationWithStream(response, true);
      }
    } else {
      // Full generation or first generation
      const brandColors = brandSite.brandColors || {
        primary: "#2563eb",
        secondary: "#64748b",
        accent: "#10b981",
      };

      // Get brand context for AI
      const fullBrandContextForAI = await brandContextService.getBrandContextForAI(
        brandSite.organizationId,
        {
          context: `${brandSite.context || ""}\n\nUser request: ${input.message}`,
          contextImages: input.attachments.length > 0 ? [...input.attachments, ...allAvailableImages] : allAvailableImages,
        },
      );

      updatedHtml = await geminiService.generateSiteHtml({
        ...fullBrandContextForAI,
        brandName: brandSite.brandName,
        colors: brandColors,
        logoUrl: brandSite.logoUrl,
        tone: brandSite.tone || "professional",
      });

      // Stream response about website generation
      logger.info("Starting streaming for website generation response", { conversationId: input.conversationId });
      const generationPrompt = `You are a helpful AI website builder. You just generated a complete website for the user based on their request: "${input.message}". Write a friendly, concise message (2-3 sentences) telling them the website is ready and they can check the preview. Be enthusiastic.`;
      response = await geminiService.streamText(
        generationPrompt,
        async (chunk, accumulated) => {
          response = accumulated;
          await updateConversationWithStream(accumulated, false);
        }
      );
      logger.info("Streaming complete for website generation", { responseLength: response.length });
      await updateConversationWithStream(response, true);
    }

    // Update brand site if HTML was generated
    // Skip this section if we already updated all pages in the incremental edit section
    if (updatedHtml && !isEditingEntireSite) {
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
          // Use the specified page slug or default to "index" for main page updates
          const currentSlug = input.pageSlug || "index";
          pageHtml = injectNavigation(updatedHtml, pages, currentSlug, brandSite.brandName);
        }
      }

      // Determine page type and slug for blog loading
      const targetPageSlug = input.pageSlug || "index";
      const targetPage = pages.find((p: any) => p.slug === targetPageSlug);
      const pageType = targetPage?.type || "standard";

      // Apply integrations (widgets, analytics, blog loader)
      const customFavicon = organization.settings?.branding?.customFavicon;
      pageHtml = applyIntegrations(pageHtml, {
        widgets: (brandSite as any).widgets,
        organizationId: organization.id,
        brandSiteId: input.brandSiteId,
        firebaseProjectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "",
        tempSiteId: `brand-${input.brandSiteId}`,
        brandName: brandSite.brandName,
        pageType: pageType,
        pageSlug: targetPageSlug,
        customFavicon,
      });

      // If creating a new page, store it separately; otherwise update specific page
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
        // Update specific page - use pageSlug to determine which page to update
        const targetPageSlug = input.pageSlug || "index";
        const existingFiles = (brandSite.files as Record<string, string>) || {};
        
        // If it's the index page, update main HTML; otherwise update in files
        if (targetPageSlug === "index") {
          await brandSiteRepository.update({
            id: input.brandSiteId,
            data: {
              html: pageHtml,
              status: "deploying",
            },
          });
        } else {
          // Update specific page in files
          await brandSiteRepository.update({
            id: input.brandSiteId,
            data: {
              status: "deploying",
              files: {
                ...existingFiles,
                [`${targetPageSlug}/index.html`]: pageHtml,
              },
            } as any,
          });
        }
      }

      if (isEditingEntireSite) {
        response += "\n\n✅ Entire site has been updated! Deploying all pages to hosting...";
      } else {
        const pageName = targetPageSlug === "index" ? "Home page" : `"${targetPageSlug}" page`;
        response += `\n\n✅ ${pageName} has been updated! Deploying to hosting...`;
      }

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
            const existingFiles = (brandSite.files as Record<string, string>) || {};
            const indexHtml = brandSite.html || existingFiles["index.html"];
            if (indexHtml) {
              const updatedIndexHtml = injectNavigation(
                indexHtml,
                updatedPages,
                "index",
                brandSite.brandName
              );
              const customFavicon = organization.settings?.branding?.customFavicon;
              const availablePagesForSiteEdit = pages.map((p: any) => ({
                slug: p.slug,
                title: p.title,
                href: p.slug === "index" || p.slug === "home" ? "/" : `/${p.slug}`,
              }));
              const indexWithIntegrations = applyIntegrations(updatedIndexHtml, {
                widgets: (brandSite as any).widgets,
                organizationId: organization.id,
                brandSiteId: input.brandSiteId,
                firebaseProjectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "",
                tempSiteId: `brand-${input.brandSiteId}`,
                brandName: brandSite.brandName,
                pageType: "standard", // Index page is typically standard
                pageSlug: "index",
                customFavicon,
                availablePages: availablePagesForSiteEdit,
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
          } else if (isEditingEntireSite) {
            // Editing entire site - deploy all pages (use updated files from Firestore)
            // Re-fetch brand site to get updated HTML/files
            const updatedBrandSite = await brandSiteRepository.get({ id: input.brandSiteId });
            if (!updatedBrandSite) {
              throw new Error("Brand site not found after update");
            }
            
            const updatedFiles = (updatedBrandSite.files as Record<string, string>) || {};
            const allPages = (updatedBrandSite.pages as any[]) || [];
            
            // Deploy index page
            const indexHtml = updatedBrandSite.html;
            if (indexHtml) {
              const customFavicon = organization.settings?.branding?.customFavicon;
              const indexWithNav = injectNavigation(indexHtml, allPages, "index", updatedBrandSite.brandName);
              const availablePagesForRegen = allPages.map((p: any) => ({
                slug: p.slug,
                title: p.title,
                href: p.slug === "index" || p.slug === "home" ? "/" : `/${p.slug}`,
              }));
              const indexWithIntegrations = applyIntegrations(indexWithNav, {
                widgets: (updatedBrandSite as any).widgets,
                organizationId: organization.id,
                brandSiteId: input.brandSiteId,
                firebaseProjectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "",
                tempSiteId: `brand-${input.brandSiteId}`,
                brandName: updatedBrandSite.brandName,
                pageType: "standard", // Index page is typically standard
                pageSlug: "index",
                customFavicon,
                availablePages: availablePagesForRegen,
              });
              filesToDeploy.push({ path: "/index.html", contents: indexWithIntegrations });
            }
            
            // Deploy all other pages
            for (const page of allPages) {
              if (page.slug === "index") continue;
              
              const pageFile = updatedFiles[`${page.slug}/index.html`];
              if (pageFile) {
                const customFavicon = organization.settings?.branding?.customFavicon;
                const pageWithNav = injectNavigation(pageFile, allPages, page.slug, updatedBrandSite.brandName);
                const pageType = page.type || "standard";
                const availablePagesForPage = allPages.map((p: any) => ({
                  slug: p.slug,
                  title: p.title,
                  href: p.slug === "index" || p.slug === "home" ? "/" : `/${p.slug}`,
                }));
                const pageWithIntegrations = applyIntegrations(pageWithNav, {
                  widgets: (updatedBrandSite as any).widgets,
                  organizationId: organization.id,
                  brandSiteId: input.brandSiteId,
                  firebaseProjectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "",
                  tempSiteId: `brand-${input.brandSiteId}`,
                  brandName: updatedBrandSite.brandName,
                  pageType: pageType,
                  pageSlug: page.slug,
                  customFavicon,
                  availablePages: availablePagesForPage,
                });
                filesToDeploy.push({ path: `/${page.slug}/index.html`, contents: pageWithIntegrations });
              }
            }
          } else {
            // Regular update - deploy the specific page that was edited
            const targetPageSlug = input.pageSlug || "index";
            const deployPath = targetPageSlug === "index" 
              ? "/index.html" 
              : `/${targetPageSlug}/index.html`;
            filesToDeploy.push({ path: deployPath, contents: pageHtml });
            
            // Only update navigation on other pages if this is not the index page
            // This ensures we don't unnecessarily regenerate all pages
            if (targetPageSlug !== "index" && pages.length > 0) {
              // Update navigation on index page to reflect any changes
              const existingFiles = (brandSite.files as Record<string, string>) || {};
              const indexHtml = brandSite.html || existingFiles["index.html"];
              if (indexHtml) {
                const updatedIndexHtml = injectNavigation(
                  indexHtml,
                  pages,
                  "index",
                  brandSite.brandName,
                );
                const customFavicon = organization.settings?.branding?.customFavicon;
                const availablePagesForFinal = pages.map((p: any) => ({
                  slug: p.slug,
                  title: p.title,
                  href: p.slug === "index" || p.slug === "home" ? "/" : `/${p.slug}`,
                }));
                const indexWithIntegrations = applyIntegrations(updatedIndexHtml, {
                  widgets: (brandSite as any).widgets,
                  organizationId: organization.id,
                  brandSiteId: input.brandSiteId,
                  firebaseProjectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "",
                  tempSiteId: `brand-${input.brandSiteId}`,
                  brandName: brandSite.brandName,
                  pageType: "standard", // Index page is typically standard
                  pageSlug: "index",
                  customFavicon,
                  availablePages: availablePagesForFinal,
                });
                filesToDeploy.push({ path: "/index.html", contents: indexWithIntegrations });
              }
            }
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

