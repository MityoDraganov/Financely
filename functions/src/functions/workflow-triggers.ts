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

const executionEngine = new WorkflowExecutionEngine();

// Initialize executors with secrets
import { HttpRequestExecutor } from "../executors/http-request-executor";
import { EmailExecutor } from "../executors/email-executor";

const httpExecutor = new HttpRequestExecutor();
const emailExecutor = new EmailExecutor({
  resendApiKey: resendApiKey.value(),
  resendFromEmail: resendFromEmail.value(),
  resendFromName: resendFromName.value(),
});

executionEngine.registerExecutor("http_request", httpExecutor);
executionEngine.registerExecutor("send_email", emailExecutor);

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
