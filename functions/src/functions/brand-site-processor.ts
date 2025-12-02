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
// Cloudflare publisher secrets (for R2 + KV)
const cloudflareAccountId = defineSecret("CLOUDFLARE_ACCOUNT_ID");
const cloudflareR2BucketName = defineSecret("CLOUDFLARE_R2_BUCKET_NAME");
const cloudflareKvNamespaceId = defineSecret("CLOUDFLARE_KV_NAMESPACE_ID");

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
      cloudflareAccountId,
      cloudflareR2BucketName,
      cloudflareKvNamespaceId,
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
          cloudflareAccountId: cloudflareAccountId.value(),
          cloudflareR2BucketName: cloudflareR2BucketName.value(),
          cloudflareKvNamespaceId: cloudflareKvNamespaceId.value(),
        },
      );

      logger.info("Brand site generation completed successfully", {
        brandSiteId,
      });

      // Record usage event
      try {
        const { recordUsageEvent } = await import("../usage");
        const { USAGE_FEATURES } = await import("../usage/usage-features");
        
        await recordUsageEvent({
          orgId: brandSiteData.organizationId,
          userId: null, // System-triggered
          featureId: USAGE_FEATURES.AI_SITE_BUILDER_GENERATE,
          metadata: {
            entityId: brandSiteId,
            context: "automation",
            payloadType: "site",
          },
        });
      } catch (usageError) {
        logger.warn("Failed to record usage event for site generation", {
          error: usageError instanceof Error ? usageError.message : String(usageError),
        });
      }
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
      cloudflareAccountId,
      cloudflareR2BucketName,
      cloudflareKvNamespaceId,
    ],
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) {
      logger.warn("onBrandSiteUpdated: Missing before or after data", {
        hasBefore: !!beforeData,
        hasAfter: !!afterData,
      });
      return;
    }

    const brandSiteId = event.params.brandSiteId;
    const beforeStatus = beforeData.status;
    const afterStatus = afterData.status;
    const beforeChatRequest = (beforeData as any)?.chatRequest;
    const afterChatRequest = (afterData as any)?.chatRequest;

    logger.info("onBrandSiteUpdated: Document updated", {
      brandSiteId,
      beforeStatus,
      afterStatus,
      hasBeforeChatRequest: !!beforeChatRequest,
      hasAfterChatRequest: !!afterChatRequest,
      beforeChatRequestId: beforeChatRequest?.id,
      afterChatRequestId: afterChatRequest?.id,
      afterChatRequestStatus: afterChatRequest?.status,
      beforeChatRequestStatus: beforeChatRequest?.status,
      timestamp: new Date().toISOString(),
    });

    // Check if this is a chat request that needs processing
    // Process if:
    // 1. chatRequest exists in afterData with status "pending"
    // 2. Either this is a new chatRequest OR the chatRequest ID changed (new message)
    const isNewChatRequest = !beforeChatRequest && afterChatRequest;
    const isDifferentChatRequest = beforeChatRequest && afterChatRequest && 
      beforeChatRequest.id !== afterChatRequest.id;
    const hasPendingChatRequest = afterChatRequest && afterChatRequest.status === "pending";
    
    logger.info("onBrandSiteUpdated: Chat request check", {
      brandSiteId,
      isNewChatRequest,
      isDifferentChatRequest,
      hasPendingChatRequest,
      willProcess: hasPendingChatRequest && (isNewChatRequest || isDifferentChatRequest),
    });
    
    if (hasPendingChatRequest && (isNewChatRequest || isDifferentChatRequest)) {
      logger.info("Processing chat request", {
        brandSiteId,
        chatRequestId: afterChatRequest.id,
        isNewRequest: isNewChatRequest,
        beforeStatus,
        afterStatus,
      });

      try {
        logger.info("Calling handleChatGenerateSite", {
          brandSiteId,
          chatRequestId: afterChatRequest.id,
          conversationId: afterChatRequest.conversationId,
          pageSlug: afterChatRequest.pageSlug || "all",
          messagePreview: afterChatRequest.message.substring(0, 100),
        });

        const result = await handleChatGenerateSite(
          {
            brandSiteId,
            message: afterChatRequest.message,
            attachments: afterChatRequest.attachments || [],
            conversationHistory: afterChatRequest.conversationHistory || [],
            conversationId: afterChatRequest.conversationId || null,
            pageSlug: afterChatRequest.pageSlug || undefined,
          },
          {
            geminiApiKey: geminiApiKey.value(),
          },
        );

        // The conversation should already be updated by handleChatGenerateSite via streaming
        // We just need to clear the chatRequest and ensure the final message is there
        // IMPORTANT: Re-read brandSite to get the latest conversations (including streaming updates)
        const databaseService = getDatabaseService();
        const brandSiteRepository = getBrandSiteRepository(databaseService);
        
        // Wait a bit to ensure streaming updates have been written
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const brandSite = await brandSiteRepository.get({ id: brandSiteId });
        if (!brandSite) {
          logger.error("Brand site not found when trying to finalize conversation", { brandSiteId });
          return;
        }
        
        const conversations = (brandSite.conversations as any[]) || [];
        const conversationId = afterChatRequest.conversationId;
        
        logger.info("Finalizing conversation after processing", {
          brandSiteId,
          conversationId,
          existingConversationsCount: conversations.length,
          conversationIds: conversations.map((c: any) => c.id),
        });
        
        let updatedConversations = [...conversations]; // Always create a new array
        if (conversationId) {
          // Find the conversation
          const conversationIndex = conversations.findIndex((c) => c.id === conversationId);
          if (conversationIndex >= 0) {
            const conversation = conversations[conversationIndex];
            
            // Check if there's already a streaming message that was updated
            const streamingMessageIndex = conversation.messages.findIndex(
              (m: any) => m.role === "assistant" && m.id?.startsWith("assistant-streaming")
            );
            
            if (streamingMessageIndex >= 0) {
              // Update the existing streaming message with final content (rename ID to final)
              const streamingMessage = conversation.messages[streamingMessageIndex];
              const finalMessage = {
                ...streamingMessage,
                id: `assistant-${Date.now()}`,
                content: result.response || streamingMessage.content,
                timestamp: new Date().toISOString(),
              };
              // Remove attachments if undefined
              if (!finalMessage.attachments || finalMessage.attachments.length === 0) {
                delete finalMessage.attachments;
              }
              
              updatedConversations[conversationIndex] = {
                ...conversation,
                messages: conversation.messages.map((msg: any, idx: number) => {
                  if (idx === streamingMessageIndex) {
                    return finalMessage;
                  }
                  // Clean up any undefined attachments in other messages
                  if (msg.attachments && msg.attachments.length === 0) {
                    const cleaned = { ...msg };
                    delete cleaned.attachments;
                    return cleaned;
                  }
                  return msg;
                }),
                updatedAt: new Date().toISOString(),
              };
              
              logger.info("Converted streaming message to final message", {
                conversationId,
                messageId: finalMessage.id,
                contentLength: finalMessage.content.length,
              });
            } else {
              // No streaming message found, add final message
              const finalMessage: any = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: result.response,
                timestamp: new Date().toISOString(),
              };
              
              updatedConversations[conversationIndex] = {
                ...conversation,
                messages: [
                  ...conversation.messages,
                  finalMessage,
                ],
                updatedAt: new Date().toISOString(),
              };
              
              logger.info("Added final message (no streaming message found)", {
                conversationId,
                messageId: finalMessage.id,
              });
            }
          } else {
            // Create new conversation if not found (shouldn't happen, but handle it)
            const userMessage: any = {
              id: `user-${Date.now()}`,
              role: "user",
              content: afterChatRequest.message,
              timestamp: new Date().toISOString(),
            };
            if (afterChatRequest.attachments && afterChatRequest.attachments.length > 0) {
              userMessage.attachments = afterChatRequest.attachments;
            }
            
            const assistantMessage: any = {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: result.response,
              timestamp: new Date().toISOString(),
            };
            
            updatedConversations = [
              ...conversations,
              {
                id: conversationId,
                messages: [userMessage, assistantMessage],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ];
            
            logger.warn("Created new conversation (shouldn't happen)", {
              conversationId,
              brandSiteId,
            });
          }
        }

        // Clean up any undefined values in conversations before saving
        const cleanedConversations = updatedConversations.map((conv: any) => {
          const cleanedMessages = conv.messages.map((msg: any) => {
            const cleaned: any = {
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
            };
            if (msg.attachments && msg.attachments.length > 0) {
              cleaned.attachments = msg.attachments;
            }
            return cleaned;
          });
          
          return {
            id: conv.id,
            title: conv.title,
            messages: cleanedMessages,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
          };
        });

        // Clear the chatRequest and update conversations
        logger.info("Saving final conversations", {
          brandSiteId,
          conversationId,
          conversationsCount: cleanedConversations.length,
          totalMessages: cleanedConversations.reduce((sum: number, conv: any) => sum + conv.messages.length, 0),
        });
        
        await brandSiteRepository.update({
          id: brandSiteId,
          data: {
            chatRequest: null,
            conversations: cleanedConversations,
            // Status will be updated by handleChatGenerateSite (deploying -> success/failed)
          } as any, // Type assertion for chatRequest field
        });
        
        logger.info("Successfully saved conversations and cleared chatRequest", {
          brandSiteId,
          conversationId,
          conversationsCount: cleanedConversations.length,
        });

        logger.info("Chat request processed successfully", {
          brandSiteId,
          chatRequestId: afterChatRequest.id,
          updated: result.updated,
          requiresClarification: result.requiresClarification,
        });

        // Record usage event for chat-based site generation
        try {
          const { recordUsageEvent } = await import("../usage");
          const { USAGE_FEATURES } = await import("../usage/usage-features");
          
          await recordUsageEvent({
            orgId: afterData.organizationId,
            userId: null, // System-triggered
            featureId: USAGE_FEATURES.AI_SITE_BUILDER_CHAT,
            metadata: {
              entityId: brandSiteId,
              context: "automation",
              payloadType: "site",
            },
          });
        } catch (usageError) {
          logger.warn("Failed to record usage event for chat site generation", {
            error: usageError instanceof Error ? usageError.message : String(usageError),
          });
        }
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
          cloudflareAccountId: cloudflareAccountId.value(),
          cloudflareR2BucketName: cloudflareR2BucketName.value(),
          cloudflareKvNamespaceId: cloudflareKvNamespaceId.value(),
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

