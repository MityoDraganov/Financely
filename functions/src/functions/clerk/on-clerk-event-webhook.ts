import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { handleClerkWebhook } from "../../app/clerk/handle-clerk-webhook";
import { serviceHost } from "../../services";
import { WorkflowExecutionEngine } from "../../services/workflow-execution-engine";
import { WorkflowEvent } from "../../core/entities/workflow-execution";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import { HttpRequestExecutor } from "../../executors/http-request-executor";
import { EmailExecutor } from "../../executors/email-executor";
import { InvoiceExecutor } from "../../executors/invoice-executor";
import { ProposalExecutor } from "../../executors/proposal-executor";
import { LeadExecutor } from "../../executors/lead-executor";
import { ContactExecutor } from "../../executors/contact-executor";
import { SystemExecutor } from "../../executors/system-executor";
import { SlackExecutor } from "../../executors/slack-executor";
import { PdfExecutor } from "../../executors/pdf-executor";
import { ProductExecutor } from "../../executors/product-executor";
import { StripeExecutor } from "../../executors/stripe-executor";
import { repositoryHost } from "../../repositories";

const loggerService = serviceHost.getLoggerService();

// Define the Clerk webhook secret
const clerkWebhookSecret = defineSecret("CLERK_WEBHOOK_SECRET");
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

function getExecutionEngine(): WorkflowExecutionEngine {
  const executionEngine = new WorkflowExecutionEngine();
  
  const httpExecutor = new HttpRequestExecutor();
  const emailExecutor = new EmailExecutor({
    resendApiKey: resendApiKey.value(),
    resendFromEmail: resendFromEmail.value(),
    resendFromName: resendFromName.value(),
  });
  const invoiceExecutor = new InvoiceExecutor();
  const proposalExecutor = new ProposalExecutor({
    resendApiKey: resendApiKey.value(),
    resendFromEmail: resendFromEmail.value(),
    resendFromName: resendFromName.value(),
  });
  const leadExecutor = new LeadExecutor();
  const contactExecutor = new ContactExecutor();
  const systemExecutor = new SystemExecutor();
  const slackExecutor = new SlackExecutor();
  const pdfExecutor = new PdfExecutor();
  const productExecutor = new ProductExecutor();
  const stripeExecutor = new StripeExecutor();

  executionEngine.registerExecutor("http_request", httpExecutor);
  executionEngine.registerExecutor("call.webhook", httpExecutor);
  executionEngine.registerExecutor("send.email", emailExecutor);
  executionEngine.registerExecutor("send.slack", slackExecutor);
  executionEngine.registerExecutor("update.invoice.status", invoiceExecutor);
  executionEngine.registerExecutor("generate.pdf", pdfExecutor);
  executionEngine.registerExecutor("create.proposal", proposalExecutor);
  executionEngine.registerExecutor("send.proposal", proposalExecutor);
  executionEngine.registerExecutor("convert.proposal_to_invoice", proposalExecutor);
  executionEngine.registerExecutor("create.lead", leadExecutor);
  executionEngine.registerExecutor("update.lead.status", leadExecutor);
  executionEngine.registerExecutor("convert.lead_to_contact", leadExecutor);
  executionEngine.registerExecutor("create.contact", contactExecutor);
  executionEngine.registerExecutor("update.contact", contactExecutor);
  executionEngine.registerExecutor("add.product_to_proposal", productExecutor);
  executionEngine.registerExecutor("create.stripe.invoice", stripeExecutor);
  executionEngine.registerExecutor("wait.delay", systemExecutor);
  executionEngine.registerExecutor("archive.record", systemExecutor);
  executionEngine.registerExecutor("update.field", systemExecutor);
  
  return executionEngine;
}

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
    secrets: [clerkWebhookSecret, resendApiKey, resendFromEmail, resendFromName],
    cors: true,
    region: "us-central1",
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

      // Verify webhook and get event data
      const { Webhook } = await import("svix");
      const webhook = new Webhook(clerkWebhookSecret.value());
      const event = webhook.verify(request.rawBody.toString(), {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as any;

      // Process webhook (creates/updates user in Firestore)
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

      // Trigger workflow for user.joined event if this is a user.created event
      if (event.type === "user.created") {
        try {
          const databaseService = serviceHost.getDatabaseService();
          const userRepository = repositoryHost.getUsersRepository(databaseService);
          const user = await userRepository.get({ id: event.data.id });
          const organizationIds = user?.organizationRoles ? Object.keys(user.organizationRoles) : [];
          
          // Trigger workflow for each organization the user belongs to
          for (const orgId of organizationIds) {
            const workflowEvent: WorkflowEvent = {
              eventId: uuidv4(),
              tenantId: orgId,
              type: "user.joined",
              payload: {
                userId: event.data.id,
                email: event.data.email_addresses?.[0]?.email_address,
                name: `${event.data.first_name || ""} ${event.data.last_name || ""}`.trim(),
                ...event.data,
              },
              timestamp: FieldValue.serverTimestamp() as any,
            };

            const executionEngine = getExecutionEngine();
            await executionEngine.processEvent(workflowEvent);
            
            loggerService.info("Triggered workflow for user.joined event", {
              userId: event.data.id,
              organizationId: orgId,
              eventId: workflowEvent.eventId,
            });
          }
        } catch (error) {
          loggerService.error("Error triggering workflow for user.joined event", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
          // Don't fail the webhook if workflow trigger fails
        }
      }

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

