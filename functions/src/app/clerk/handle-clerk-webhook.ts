import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/backend";
import { ClerkEventType, LoggerService } from "../../core";
import { createClerkUserInFirestore } from "./create-clerk-user-in-firestore";
import { deleteClerkUserFromFirestore } from "./delete-clerk-user-from-firestore";
import { repositoryHost } from "../../repositories";
import { serviceHost } from "../../services";

interface Payload {
  svixId: string;
  svixSignature: string;
  svixTimestamp: string;
  rawBody: Buffer;
  webhookSecret: string;
}

interface Dependencies {
  loggerService: LoggerService;
}

/**
 * Handle Clerk webhook events
 *
 * @param {Payload} payload - Webhook data from Clerk
 * @param {Dependencies} dependencies - Required services
 * @return {Promise<void>}
 */
export async function handleClerkWebhook(
  payload: Payload,
  dependencies: Dependencies,
): Promise<void> {
  const { svixId, svixSignature, svixTimestamp, rawBody, webhookSecret } = payload;
  const { loggerService } = dependencies;

  loggerService.info("Processing Clerk webhook event");

  if (!webhookSecret) {
    throw new Error("Clerk webhook secret not found");
  }

  // Verify the webhook signature using Svix
  const webhook = new Webhook(webhookSecret);
  let event: WebhookEvent;

  try {
    event = webhook.verify(rawBody.toString(), {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (error) {
    loggerService.error("Error verifying webhook:", error);
    throw new Error("Invalid webhook signature");
  }

  loggerService.info("Webhook verified successfully, event type:", event.type);

  // Get dependencies
  const databaseService = serviceHost.getDatabaseService();
  const userRepository = repositoryHost.getUsersRepository(databaseService);

  // Store event for workflow trigger (if needed)
  (dependencies as any).verifiedEvent = event;

  // Handle different event types
  switch (event.type) {
    case ClerkEventType.USER_CREATED:
      loggerService.info("Handling user.created event");
      await createClerkUserInFirestore(
        { clerkUser: event.data },
        { loggerService, userRepository },
      );
      
      // Note: Workflow trigger for user.joined will be handled in the Clerk webhook function
      // after the user is created in Firestore, so we can get the organization IDs
      break;

    case ClerkEventType.USER_UPDATED:
      loggerService.info("Handling user.updated event");
      // For now, we'll recreate/update the user on update events
      await createClerkUserInFirestore(
        { clerkUser: event.data },
        { loggerService, userRepository },
      );
      break;

    case ClerkEventType.USER_DELETED:
      loggerService.info("Handling user.deleted event");
      await deleteClerkUserFromFirestore(
        { clerkUser: event.data },
        { loggerService, userRepository },
      );
      break;

    default:
      loggerService.info("Unhandled event type:", event.type);
  }

  loggerService.info("Clerk webhook processed successfully");
}

