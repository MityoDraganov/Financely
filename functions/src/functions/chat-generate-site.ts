import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";

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
  conversationId?: string;
}

/**
 * Chat-based site generation function.
 * Returns immediately after storing the chat request.
 * The actual generation is processed asynchronously by a Firestore trigger.
 */
export const chatGenerateSite = onCall<ChatGenerateSitePayload>(
  {
    region: "us-central1",
    cors: true,
    timeoutSeconds: 60, // Fast response - just stores request
    memory: "256MiB",
  },
  async (request) => {
    try {
      const { brandSiteId, message, attachments = [], conversationHistory = [], conversationId } = request.data;

      if (!brandSiteId) {
        throw new HttpsError("invalid-argument", "brandSiteId is required");
      }

      if (!message || !message.trim()) {
        throw new HttpsError("invalid-argument", "message is required");
      }

      logger.info("Initiating chat-based site generation", {
        brandSiteId,
        messageLength: message.length,
        attachmentCount: attachments.length,
        historyLength: conversationHistory.length,
        conversationId,
      });

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      // Get brand site to verify it exists
      const brandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!brandSite) {
        throw new HttpsError("not-found", "Brand site not found");
      }

      // Store chat request in brand site document to trigger async processing
      // Use a special field to indicate a chat request is pending
      const chatRequestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      
      // Ensure conversationId is set - create one if not provided
      const finalConversationId = conversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      
      logger.info("Storing chat request with conversationId", {
        brandSiteId,
        conversationId: finalConversationId,
        wasProvided: !!conversationId,
        chatRequestId,
      });
      
      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          // Store the chat request in metadata (using type assertion since it's not in schema yet)
          chatRequest: {
            id: chatRequestId,
            message,
            attachments,
            conversationHistory,
            conversationId: finalConversationId, // Always set conversationId
            status: "pending",
            createdAt: new Date().toISOString(),
          },
          // Set status to "generating" to trigger the processor
          status: "generating",
        } as any, // Type assertion needed for chatRequest field
      });

      logger.info("Chat request stored, processing will begin asynchronously", {
        brandSiteId,
        chatRequestId,
      });

      // Return immediately - the Firestore trigger will process it
      return {
        response: "Processing your request...",
        updated: false,
        requiresClarification: false,
        brandSiteId,
        chatRequestId,
      };
    } catch (error) {
      logger.error("Error initiating chat generation", {
        error: error instanceof Error ? error.message : "Unknown error",
        data: request.data,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to initiate chat generation",
      );
    }
  },
);


