import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { handleClerkWebhook } from "../../app/clerk/handle-clerk-webhook";
import { serviceHost } from "../../services";

const loggerService = serviceHost.getLoggerService();

// Define the Clerk webhook secret
const clerkWebhookSecret = defineSecret("CLERK_WEBHOOK_SECRET");

/**
 * HTTP Cloud Function triggered by Clerk webhook events
 * 
 * This function receives webhooks from Clerk for user lifecycle events
 * (created, updated, deleted) and syncs them to Firestore.
 * 
 * Setup in Clerk Dashboard:
 * 1. Go to Webhooks in Clerk Dashboard
 * 2. Add endpoint: https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/onClerkWebhookEvent
 * 3. Subscribe to events: user.created, user.updated, user.deleted
 * 4. Copy the signing secret and add to Firebase:
 *    firebase functions:secrets:set CLERK_WEBHOOK_SECRET
 */
export const onClerkWebhookEvent = onRequest(
  {
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
    secrets: [clerkWebhookSecret],
    cors: true,
  },
  async (request, response) => {
    try {
      // Get Svix headers for signature verification
      const svixId = request.headers["svix-id"] as string;
      const svixSignature = request.headers["svix-signature"] as string;
      const svixTimestamp = request.headers["svix-timestamp"] as string;

      loggerService.info("Received Clerk webhook");
      loggerService.info("svix-id:", svixId);
      loggerService.info("svix-timestamp:", svixTimestamp);

      // Validate headers
      if (!svixId || !svixSignature || !svixTimestamp) {
        loggerService.error("Missing required Svix headers");
        response.status(400).send("Missing Svix headers");
        return;
      }

      // Process webhook
      await handleClerkWebhook(
        {
          svixId,
          svixSignature,
          svixTimestamp,
          rawBody: request.rawBody,
          webhookSecret: clerkWebhookSecret.value(),
        },
        {
          loggerService,
        },
      );

      response.status(200).json({ success: true, message: "Webhook processed" });
    } catch (error) {
      loggerService.error("Error processing Clerk webhook:", error);
      response.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Invalid webhook" 
      });
    }
  },
);

