import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { handleGenerateSite } from "../app/handle-generate-site";
import { handleChatGenerateSite } from "../app/handle-chat-generate-site";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getBrandSiteRepository } from "../repositories/brand-site-repository";

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const cloudflareApiToken = defineSecret("CLOUDFLARE_API_TOKEN");
const cloudflareZoneId = defineSecret("CLOUDFLARE_ZONE_ID");
const cloudflareBaseDomain = defineSecret("CLOUDFLARE_BASE_DOMAIN");
const firebaseProjectId = defineSecret("FIREBASE_PROJECT_ID");

/**
 * Firestore trigger that processes brand site generation asynchronously.
 * This runs when a brand site document is created or updated with status "pending".
 */
export const onBrandSiteCreated = onDocumentCreated(
  {
    document: "brandSites/{brandSiteId}",
    region: "us-central1",
    secrets: [
      geminiApiKey,
      cloudflareApiToken,
      cloudflareZoneId,
      cloudflareBaseDomain,
      firebaseProjectId,
    ],
    timeoutSeconds: 540, // 9 minutes max
    memory: "1GiB",
  },
  async (event) => {
    const brandSiteData = event.data?.data();
    if (!brandSiteData) {
      logger.warn("No brand site data in event");
      return;
    }

    const brandSiteId = event.params.brandSiteId;
    const status = brandSiteData.status;

    // Only process if status is "pending"
    if (status !== "pending") {
      logger.info("Brand site not in pending status, skipping", {
        brandSiteId,
        status,
      });
      return;
    }

    // Guard against duplicate processing: immediately update status to "generating"
    // This prevents multiple triggers from processing the same site
    const databaseService = getDatabaseService();
    const brandSiteRepository = getBrandSiteRepository(databaseService);
    
    try {
      // Try to atomically update status from "pending" to "generating"
      // If this fails, another instance is already processing
      const currentBrandSite = await brandSiteRepository.get({ id: brandSiteId });
      if (!currentBrandSite || currentBrandSite.status !== "pending") {
        logger.info("Brand site status changed, another instance is processing", {
          brandSiteId,
          currentStatus: currentBrandSite?.status,
        });
        return;
      }

      // Atomically update status to prevent duplicate processing
      await brandSiteRepository.update({
        id: brandSiteId,
        data: {
          status: "generating",
        },
      });
    } catch (error) {
      logger.warn("Failed to update status, another instance may be processing", {
        brandSiteId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return;
    }

    logger.info("Processing brand site generation", {
      brandSiteId,
      organizationId: brandSiteData.organizationId,
    });

    try {
      // Note: handleGenerateSite will find the existing brand site by organizationId
      await handleGenerateSite(
        {
          organizationId: brandSiteData.organizationId,
          brandName: brandSiteData.brandName,
          tone: brandSiteData.tone,
        },
        {
          geminiApiKey: geminiApiKey.value(),
          cloudflareApiToken: cloudflareApiToken.value(),
          cloudflareZoneId: cloudflareZoneId.value(),
          cloudflareBaseDomain: cloudflareBaseDomain.value(),
          firebaseProjectId: firebaseProjectId.value(),
        },
      );

      logger.info("Brand site generation completed successfully", {
        brandSiteId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to process brand site generation", {
        brandSiteId,
        error: errorMessage,
      });

      // Update the brand site with error status
      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      try {
        await brandSiteRepository.update({
          id: brandSiteId,
          data: {
            status: "failed",
            error: errorMessage,
          },
        });
      } catch (updateError) {
        logger.error("Failed to update brand site with error status", {
          brandSiteId,
          updateError: updateError instanceof Error ? updateError.message : "Unknown error",
        });
      }
    }
  },
);

/**
 * Also handle updates in case status is manually reset to "pending" or "generating"
 */
export const onBrandSiteUpdated = onDocumentUpdated(
  {
    document: "brandSites/{brandSiteId}",
    region: "us-central1",
    secrets: [
      geminiApiKey,
      cloudflareApiToken,
      cloudflareZoneId,
      cloudflareBaseDomain,
      firebaseProjectId,
    ],
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) {
      return;
    }

    const brandSiteId = event.params.brandSiteId;
    const beforeStatus = beforeData.status;
    const afterStatus = afterData.status;
    const beforeChatRequest = (beforeData as any).chatRequest;
    const afterChatRequest = (afterData as any).chatRequest;

    // Check if this is a chat request that needs processing
    // Process if:
    // 1. chatRequest exists in afterData with status "pending"
    // 2. Either this is a new chatRequest OR the chatRequest ID changed (new message)
    const isNewChatRequest = !beforeChatRequest && afterChatRequest;
    const isDifferentChatRequest = beforeChatRequest && afterChatRequest && 
      beforeChatRequest.id !== afterChatRequest.id;
    const hasPendingChatRequest = afterChatRequest && afterChatRequest.status === "pending";
    
    if (hasPendingChatRequest && (isNewChatRequest || isDifferentChatRequest)) {
      logger.info("Processing chat request", {
        brandSiteId,
        chatRequestId: afterChatRequest.id,
        isNewRequest: isNewChatRequest,
        beforeStatus,
        afterStatus,
      });

      try {
        const result = await handleChatGenerateSite(
          {
            brandSiteId,
            message: afterChatRequest.message,
            attachments: afterChatRequest.attachments || [],
            conversationHistory: afterChatRequest.conversationHistory || [],
            conversationId: afterChatRequest.conversationId || null,
          },
          {
            geminiApiKey: geminiApiKey.value(),
          },
        );

        // The conversation should already be updated by handleChatGenerateSite via streaming
        // We just need to clear the chatRequest and ensure the final message is there
        const databaseService = getDatabaseService();
        const brandSiteRepository = getBrandSiteRepository(databaseService);
        
        const brandSite = await brandSiteRepository.get({ id: brandSiteId });
        if (brandSite) {
          const conversations = (brandSite.conversations as any[]) || [];
          const conversationId = afterChatRequest.conversationId;
          
          let updatedConversations = conversations;
          if (conversationId) {
            // Find the conversation
            const conversationIndex = conversations.findIndex((c) => c.id === conversationId);
            if (conversationIndex >= 0) {
              const conversation = conversations[conversationIndex];
              updatedConversations = [...conversations];
              
              // Check if there's already a streaming message that was updated
              const streamingMessageIndex = conversation.messages.findIndex(
                (m: any) => m.role === "assistant" && m.id?.startsWith("assistant-streaming")
              );
              
              if (streamingMessageIndex >= 0) {
                // Update the existing streaming message with final content (rename ID to final)
                const streamingMessage = conversation.messages[streamingMessageIndex];
                updatedConversations[conversationIndex] = {
                  ...conversation,
                  messages: conversation.messages.map((msg: any, idx: number) => {
                    if (idx === streamingMessageIndex) {
                      // Convert streaming message to final message
                      return {
                        ...streamingMessage,
                        id: `assistant-${Date.now()}`,
                        content: result.response || streamingMessage.content,
                        timestamp: new Date().toISOString(),
                      };
                    }
                    return msg;
                  }),
                  updatedAt: new Date().toISOString(),
                };
              } else {
                // No streaming message found, add final message
                updatedConversations[conversationIndex] = {
                  ...conversation,
                  messages: [
                    ...conversation.messages,
                    {
                      id: `assistant-${Date.now()}`,
                      role: "assistant",
                      content: result.response,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                  updatedAt: new Date().toISOString(),
                };
              }
            } else {
              // Create new conversation if not found (shouldn't happen, but handle it)
              updatedConversations = [
                ...conversations,
                {
                  id: conversationId,
                  messages: [
                    {
                      id: `user-${Date.now()}`,
                      role: "user",
                      content: afterChatRequest.message,
                      attachments: afterChatRequest.attachments,
                      timestamp: new Date().toISOString(),
                    },
                    {
                      id: `assistant-${Date.now()}`,
                      role: "assistant",
                      content: result.response,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ];
            }
          }

          // Clear the chatRequest and update status
          await brandSiteRepository.update({
            id: brandSiteId,
            data: {
              chatRequest: null,
              conversations: updatedConversations,
              // Status will be updated by handleChatGenerateSite (deploying -> success/failed)
            } as any, // Type assertion for chatRequest field
          });
        }

        logger.info("Chat request processed successfully", {
          brandSiteId,
          chatRequestId: afterChatRequest.id,
          updated: result.updated,
          requiresClarification: result.requiresClarification,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("Failed to process chat request", {
          brandSiteId,
          chatRequestId: afterChatRequest.id,
          error: errorMessage,
        });

        const databaseService = getDatabaseService();
        const brandSiteRepository = getBrandSiteRepository(databaseService);

        try {
          // Clear chatRequest and set status to failed
          await brandSiteRepository.update({
            id: brandSiteId,
            data: {
              chatRequest: null,
              status: "failed",
              error: errorMessage,
            } as any, // Type assertion for chatRequest field
          });
        } catch (updateError) {
          logger.error("Failed to update brand site with error status", {
            brandSiteId,
            updateError: updateError instanceof Error ? updateError.message : "Unknown error",
          });
        }
      }
      return;
    }

    // Only process if status changed TO "pending" (wasn't pending before)
    if (beforeStatus === "pending" || afterStatus !== "pending") {
      return;
    }

    logger.info("Brand site status changed to pending, processing", {
      brandSiteId,
      beforeStatus,
      afterStatus,
    });

    try {
      await handleGenerateSite(
        {
          organizationId: afterData.organizationId,
          brandName: afterData.brandName,
          tone: afterData.tone,
        },
        {
          geminiApiKey: geminiApiKey.value(),
          cloudflareApiToken: cloudflareApiToken.value(),
          cloudflareZoneId: cloudflareZoneId.value(),
          cloudflareBaseDomain: cloudflareBaseDomain.value(),
          firebaseProjectId: firebaseProjectId.value(),
        },
      );

      logger.info("Brand site regeneration completed successfully", {
        brandSiteId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to process brand site regeneration", {
        brandSiteId,
        error: errorMessage,
      });

      const databaseService = getDatabaseService();
      const brandSiteRepository = getBrandSiteRepository(databaseService);

      try {
        await brandSiteRepository.update({
          id: brandSiteId,
          data: {
            status: "failed",
            error: errorMessage,
          },
        });
      } catch (updateError) {
        logger.error("Failed to update brand site with error status", {
          brandSiteId,
          updateError: updateError instanceof Error ? updateError.message : "Unknown error",
        });
      }
    }
  },
);

