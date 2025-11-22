import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { WorkflowExecutionEngine } from "../services/workflow-execution-engine";
import { WorkflowEvent } from "../core/entities/workflow-execution";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";

// Define secrets
const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");
const resendFromName = defineSecret("RESEND_FROM_NAME");

// Initialize executors lazily (at runtime, not at module load time)
import { HttpRequestExecutor } from "../executors/http-request-executor";
import { EmailExecutor } from "../executors/email-executor";
import { InvoiceExecutor } from "../executors/invoice-executor";
import { ProposalExecutor } from "../executors/proposal-executor";
import { LeadExecutor } from "../executors/lead-executor";
import { ContactExecutor } from "../executors/contact-executor";
import { SystemExecutor } from "../executors/system-executor";
import { SlackExecutor } from "../executors/slack-executor";
import { PdfExecutor } from "../executors/pdf-executor";
import { ProductExecutor } from "../executors/product-executor";
import { StripeExecutor } from "../executors/stripe-executor";

function getExecutionEngine(): WorkflowExecutionEngine {
  const executionEngine = new WorkflowExecutionEngine();
  
  // HTTP and Email executors
  const httpExecutor = new HttpRequestExecutor();
  const emailExecutor = new EmailExecutor({
    resendApiKey: resendApiKey.value(),
    resendFromEmail: resendFromEmail.value(),
    resendFromName: resendFromName.value(),
  });

  // Business logic executors
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

  // Register all executors
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
 * Handle invoice created events
 */
export const onInvoiceCreated = onDocumentCreated({
  document: "invoices/{invoiceId}",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (event) => {
  const invoiceData = event.data?.data();
  if (!invoiceData) return;

  const workflowEvent: WorkflowEvent = {
    eventId: uuidv4(),
    tenantId: invoiceData.tenantId || invoiceData.orgId,
    type: "invoice.created",
    payload: {
      invoiceId: event.params.invoiceId,
      ...invoiceData,
    },
    timestamp: FieldValue.serverTimestamp() as any,
  };

  try {
    const executionEngine = getExecutionEngine();
    await executionEngine.processEvent(workflowEvent);
  } catch (error) {
    logger.error("Error processing invoice.created event", { 
      invoiceId: event.params.invoiceId,
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

/**
 * Handle invoice paid events
 */
export const onInvoicePaid = onDocumentUpdated({
  document: "invoices/{invoiceId}",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();
  
  if (!beforeData || !afterData) return;

  // Check if status changed to paid
  if (beforeData.status !== "paid" && afterData.status === "paid") {
    const workflowEvent: WorkflowEvent = {
      eventId: uuidv4(),
      tenantId: afterData.tenantId || afterData.orgId,
      type: "invoice.paid",
      payload: {
        invoiceId: event.params.invoiceId,
        ...afterData,
      },
      timestamp: FieldValue.serverTimestamp() as any,
    };

    try {
      const executionEngine = getExecutionEngine();
      await executionEngine.processEvent(workflowEvent);
    } catch (error) {
      logger.error("Error processing invoice.paid event", { 
        invoiceId: event.params.invoiceId,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }
});

/**
 * Manual workflow trigger endpoint
 */
export const triggerWorkflow = onRequest({
  region: "us-central1",
  cors: true,
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (req, res) => {
  try {
    const { workflowId, tenantId, payload } = req.body;

    if (!workflowId || !tenantId) {
      res.status(400).json({ 
        error: "Missing required fields: workflowId, tenantId" 
      });
      return;
    }

    const workflowEvent: WorkflowEvent = {
      eventId: uuidv4(),
      tenantId,
      type: "manual.trigger",
      payload: {
        workflowId,
        ...payload,
      },
      correlationId: req.headers["x-correlation-id"] as string,
      idempotencyKey: req.headers["x-idempotency-key"] as string,
      timestamp: FieldValue.serverTimestamp() as any,
    };

    const executionEngine = getExecutionEngine();
    await executionEngine.processEvent(workflowEvent);

    res.status(200).json({ 
      success: true, 
      eventId: workflowEvent.eventId 
    });

  } catch (error) {
    logger.error("Error in manual workflow trigger", { 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
    
    res.status(500).json({ 
      error: "Internal server error" 
    });
  }
});

/**
 * Step execution endpoint for Cloud Tasks
 */
export const executeStep = onRequest({
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (req, res) => {
  try {
    const { runId } = req.body;

    if (!runId) {
      res.status(400).json({ error: "Missing runId" });
      return;
    }

    const executionEngine = getExecutionEngine();
    await executionEngine.processNextStep(runId);

    res.status(200).json({ success: true });

  } catch (error) {
    logger.error("Error executing step", { 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
    
    res.status(500).json({ 
      error: "Internal server error" 
    });
  }
});

/**
 * Webhook endpoint for external events
 */
export const webhookHandler = onRequest({
  region: "us-central1",
  cors: true,
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (req, res) => {
  try {
    const { tenantId, eventType, payload } = req.body;

    if (!tenantId || !eventType) {
      res.status(400).json({ 
        error: "Missing required fields: tenantId, eventType" 
      });
      return;
    }

    const workflowEvent: WorkflowEvent = {
      eventId: uuidv4(),
      tenantId,
      type: eventType,
      payload: payload || {},
      correlationId: req.headers["x-correlation-id"] as string,
      idempotencyKey: req.headers["x-idempotency-key"] as string,
      timestamp: FieldValue.serverTimestamp() as any,
    };

    const executionEngine = getExecutionEngine();
    await executionEngine.processEvent(workflowEvent);

    res.status(200).json({ 
      success: true, 
      eventId: workflowEvent.eventId 
    });

  } catch (error) {
    logger.error("Error in webhook handler", { 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
    
    res.status(500).json({ 
      error: "Internal server error" 
    });
  }
});
