import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { WorkflowExecutionEngine } from "../services/workflow-execution-engine";
import { WorkflowEvent } from "../core/entities/workflow-execution";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import { firestore as db } from "../infrastructure/firebase";

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
 * Handle invoice sent events (when status changes to sent)
 */
export const onInvoiceSent = onDocumentUpdated({
  document: "invoices/{invoiceId}",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();
  
  if (!beforeData || !afterData) return;

  // Check if status changed to sent
  if (beforeData.status !== "sent" && afterData.status === "sent") {
    const workflowEvent: WorkflowEvent = {
      eventId: uuidv4(),
      tenantId: afterData.tenantId || afterData.orgId,
      type: "invoice.sent",
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
      logger.error("Error processing invoice.sent event", { 
        invoiceId: event.params.invoiceId,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }
});

/**
 * Handle lead converted events (when status changes to converted)
 */
export const onLeadConverted = onDocumentUpdated({
  document: "leads/{leadId}",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();
  
  if (!beforeData || !afterData) return;

  // Check if status changed to converted
  if (beforeData.status !== "converted" && afterData.status === "converted") {
    const workflowEvent: WorkflowEvent = {
      eventId: uuidv4(),
      tenantId: afterData.organizationId,
      type: "lead.converted",
      payload: {
        leadId: event.params.leadId,
        ...afterData,
      },
      timestamp: FieldValue.serverTimestamp() as any,
    };

    try {
      const executionEngine = getExecutionEngine();
      await executionEngine.processEvent(workflowEvent);
    } catch (error) {
      logger.error("Error processing lead.converted event", { 
        leadId: event.params.leadId,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }
});

/**
 * Handle contact created events
 */
export const onContactCreated = onDocumentCreated({
  document: "contacts/{contactId}",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (event) => {
  const contactData = event.data?.data();
  if (!contactData) return;

  const workflowEvent: WorkflowEvent = {
    eventId: uuidv4(),
    tenantId: contactData.organizationId || contactData.data?.organizationId,
    type: "contact.created",
    payload: {
      contactId: event.params.contactId,
      ...contactData,
    },
    timestamp: FieldValue.serverTimestamp() as any,
  };

  try {
    const executionEngine = getExecutionEngine();
    await executionEngine.processEvent(workflowEvent);
  } catch (error) {
    logger.error("Error processing contact.created event", { 
      contactId: event.params.contactId,
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

/**
 * Handle contact updated events
 */
export const onContactUpdated = onDocumentUpdated({
  document: "contacts/{contactId}",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (event) => {
  const afterData = event.data?.after.data();
  if (!afterData) return;

  const workflowEvent: WorkflowEvent = {
    eventId: uuidv4(),
    tenantId: afterData.organizationId || afterData.data?.organizationId,
    type: "contact.updated",
    payload: {
      contactId: event.params.contactId,
      ...afterData,
    },
    timestamp: FieldValue.serverTimestamp() as any,
  };

  try {
    const executionEngine = getExecutionEngine();
    await executionEngine.processEvent(workflowEvent);
  } catch (error) {
    logger.error("Error processing contact.updated event", { 
      contactId: event.params.contactId,
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

/**
 * Handle proposal created events
 */
export const onProposalCreated = onDocumentCreated({
  document: "proposals/{proposalId}",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (event) => {
  const proposalData = event.data?.data();
  if (!proposalData) return;

  const workflowEvent: WorkflowEvent = {
    eventId: uuidv4(),
    tenantId: proposalData.organizationId,
    type: "proposal.created",
    payload: {
      proposalId: event.params.proposalId,
      ...proposalData,
    },
    timestamp: FieldValue.serverTimestamp() as any,
  };

  try {
    const executionEngine = getExecutionEngine();
    await executionEngine.processEvent(workflowEvent);
  } catch (error) {
    logger.error("Error processing proposal.created event", { 
      proposalId: event.params.proposalId,
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

/**
 * Handle proposal status changes (sent, approved, rejected, converted)
 */
export const onProposalStatusChanged = onDocumentUpdated({
  document: "proposals/{proposalId}",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();
  
  if (!beforeData || !afterData) return;

  const beforeStatus = beforeData.status;
  const afterStatus = afterData.status;

  // Determine event type based on status change
  let eventType: string | null = null;
  
  if (beforeStatus !== "SENT" && afterStatus === "SENT") {
    eventType = "proposal.sent";
  } else if (beforeStatus !== "ACCEPTED" && afterStatus === "ACCEPTED") {
    eventType = "proposal.approved";
  } else if (beforeStatus !== "REJECTED" && afterStatus === "REJECTED") {
    eventType = "proposal.rejected";
  } else if (beforeStatus !== "ACCEPTED" && afterStatus === "ACCEPTED" && afterData.invoiceId) {
    eventType = "proposal.converted_to_invoice";
  }

  if (!eventType) return;

  const workflowEvent: WorkflowEvent = {
    eventId: uuidv4(),
    tenantId: afterData.organizationId,
    type: eventType,
    payload: {
      proposalId: event.params.proposalId,
      ...afterData,
    },
    timestamp: FieldValue.serverTimestamp() as any,
  };

  try {
    const executionEngine = getExecutionEngine();
    await executionEngine.processEvent(workflowEvent);
  } catch (error) {
    logger.error(`Error processing ${eventType} event`, { 
      proposalId: event.params.proposalId,
      error: error instanceof Error ? error.message : "Unknown error" 
    });
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
 * Handle product created events
 */
export const onProductCreated = onDocumentCreated({
  document: "products/{productId}",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (event) => {
  const productData = event.data?.data();
  if (!productData) return;

  const workflowEvent: WorkflowEvent = {
    eventId: uuidv4(),
    tenantId: productData.organizationId,
    type: "product.created",
    payload: {
      productId: event.params.productId,
      ...productData,
    },
    timestamp: FieldValue.serverTimestamp() as any,
  };

  try {
    const executionEngine = getExecutionEngine();
    await executionEngine.processEvent(workflowEvent);
  } catch (error) {
    logger.error("Error processing product.created event", { 
      productId: event.params.productId,
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

/**
 * Handle product low stock events (when stockQuantity drops below lowStockThreshold)
 */
export const onProductLowStock = onDocumentUpdated({
  document: "products/{productId}",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();
  
  if (!beforeData || !afterData) return;

  // Check if product tracks inventory and stock is now low
  const tracksInventory = afterData.trackInventory === true;
  const stockQuantity = afterData.stockQuantity || 0;
  const lowStockThreshold = afterData.lowStockThreshold || 0;
  const previousStockQuantity = beforeData.stockQuantity || 0;

  // Trigger if stock just dropped below threshold (was above, now below)
  if (tracksInventory && previousStockQuantity > lowStockThreshold && stockQuantity <= lowStockThreshold) {
    const workflowEvent: WorkflowEvent = {
      eventId: uuidv4(),
      tenantId: afterData.organizationId,
      type: "product.low_stock",
      payload: {
        productId: event.params.productId,
        stockQuantity,
        lowStockThreshold,
        ...afterData,
      },
      timestamp: FieldValue.serverTimestamp() as any,
    };

    try {
      const executionEngine = getExecutionEngine();
      await executionEngine.processEvent(workflowEvent);
    } catch (error) {
      logger.error("Error processing product.low_stock event", { 
        productId: event.params.productId,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }
});

/**
 * Handle lead qualified events (when status changes to a qualified state)
 * Note: "qualified" is not a standard status, so we'll check for status changes to "contacted" or custom qualified status
 */
export const onLeadQualified = onDocumentUpdated({
  document: "leads/{leadId}",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
}, async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();
  
  if (!beforeData || !afterData) return;

  // Check if status changed to "contacted" (which we'll treat as qualified)
  // Or if there's a custom "qualified" status
  const beforeStatus = beforeData.status;
  const afterStatus = afterData.status;

  // Trigger if status changed to "contacted" (qualified) or if explicitly marked as qualified
  if (beforeStatus !== "contacted" && afterStatus === "contacted") {
    const workflowEvent: WorkflowEvent = {
      eventId: uuidv4(),
      tenantId: afterData.organizationId,
      type: "lead.qualified",
      payload: {
        leadId: event.params.leadId,
        ...afterData,
      },
      timestamp: FieldValue.serverTimestamp() as any,
    };

    try {
      const executionEngine = getExecutionEngine();
      await executionEngine.processEvent(workflowEvent);
    } catch (error) {
      logger.error("Error processing lead.qualified event", { 
        leadId: event.params.leadId,
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }
});

/**
 * Scheduled function to check for cron-based workflows and trigger them
 * Runs every minute to check for workflows with schedule.cron trigger
 */
export const checkCronWorkflows = onSchedule({
  schedule: "every 1 minutes",
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
  timeZone: "UTC",
}, async (event) => {
  try {
    logger.info("Checking for cron-based workflows");

    const executionEngine = getExecutionEngine();
    
    // Find all active workflows with schedule.cron trigger
    const workflowsSnapshot = await db
      .collection("workflows")
      .where("status", "==", "active")
      .where("trigger.type", "==", "schedule.cron")
      .get();

    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

    for (const workflowDoc of workflowsSnapshot.docs) {
      const workflow = workflowDoc.data();
      const cronExpression = workflow.trigger?.cronExpression;

      if (!cronExpression) {
        logger.warn("Workflow has schedule.cron trigger but no cronExpression", {
          workflowId: workflowDoc.id,
        });
        continue;
      }

      // Parse cron expression (simplified - supports: minute hour day month dayOfWeek)
      // Format: "minute hour day month dayOfWeek" (e.g., "0 9 * * *" = daily at 9 AM)
      const cronParts = cronExpression.trim().split(/\s+/);
      if (cronParts.length !== 5) {
        logger.warn("Invalid cron expression format", {
          workflowId: workflowDoc.id,
          cronExpression,
        });
        continue;
      }

      const [cronMinute, cronHour, cronDay, cronMonth, cronDayOfWeek] = cronParts;

      // Check if current time matches cron expression
      const matchesMinute = cronMinute === "*" || parseInt(cronMinute) === currentMinute;
      const matchesHour = cronHour === "*" || parseInt(cronHour) === currentHour;
      const matchesDay = cronDay === "*" || parseInt(cronDay) === currentDay;
      const matchesMonth = cronMonth === "*" || parseInt(cronMonth) === currentMonth;
      const matchesDayOfWeek = cronDayOfWeek === "*" || parseInt(cronDayOfWeek) === currentDayOfWeek;

      if (matchesMinute && matchesHour && matchesDay && matchesMonth && matchesDayOfWeek) {
        const workflowEvent: WorkflowEvent = {
          eventId: uuidv4(),
          tenantId: workflow.orgId,
          type: "schedule.cron",
          payload: {
            workflowId: workflowDoc.id,
            cronExpression,
            triggeredAt: now.toISOString(),
          },
          timestamp: FieldValue.serverTimestamp() as any,
        };

        await executionEngine.processEvent(workflowEvent);
        
        logger.info("Triggered cron workflow", {
          workflowId: workflowDoc.id,
          eventId: workflowEvent.eventId,
          cronExpression,
        });
      }
    }
  } catch (error) {
    logger.error("Error checking cron workflows", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Scheduled function to check for overdue invoices
 * Runs daily at midnight UTC
 */
export const checkOverdueInvoices = onSchedule({
  schedule: "0 0 * * *", // Daily at midnight UTC
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
  timeZone: "UTC",
}, async (event) => {
  try {
    logger.info("Checking for overdue invoices");

    const executionEngine = getExecutionEngine();
    const now = new Date();

    // Find all invoices that are not paid and have a due date in the past
    // Note: This is a simplified query - you may need to adjust based on your invoice structure
    const invoicesSnapshot = await db
      .collection("invoices")
      .where("status", "in", ["draft", "sent"])
      .get();

    for (const invoiceDoc of invoicesSnapshot.docs) {
      const invoice = invoiceDoc.data();
      const invoiceData = invoice.data || {};
      const dueDate = invoiceData.dueDate;

      if (!dueDate) continue;

      // Check if invoice is overdue
      const dueDateObj = new Date(dueDate);
      if (dueDateObj < now && invoice.status !== "paid") {
        const workflowEvent: WorkflowEvent = {
          eventId: uuidv4(),
          tenantId: invoice.orgId || invoice.tenantId,
          type: "invoice.overdue",
          payload: {
            invoiceId: invoiceDoc.id,
            dueDate,
            ...invoiceData,
          },
          timestamp: FieldValue.serverTimestamp() as any,
        };

        await executionEngine.processEvent(workflowEvent);
        
        logger.info("Triggered workflow for overdue invoice", {
          invoiceId: invoiceDoc.id,
          eventId: workflowEvent.eventId,
        });
      }
    }
  } catch (error) {
    logger.error("Error checking overdue invoices", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Scheduled function to check for expiring and expired contracts
 * Runs daily at midnight UTC
 */
export const checkContractExpiry = onSchedule({
  schedule: "0 0 * * *", // Daily at midnight UTC
  region: "us-central1",
  secrets: [resendApiKey, resendFromEmail, resendFromName],
  timeZone: "UTC",
}, async (event) => {
  try {
    logger.info("Checking for expiring and expired contracts");

    const executionEngine = getExecutionEngine();
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find contracts collection (adjust collection name if different)
    // Note: This assumes contracts have an expirationDate field
    const contractsSnapshot = await db
      .collection("contracts")
      .where("status", "==", "active")
      .get();

    for (const contractDoc of contractsSnapshot.docs) {
      const contract = contractDoc.data();
      const expirationDate = contract.expirationDate || contract.data?.expirationDate;

      if (!expirationDate) continue;

      const expirationDateObj = new Date(expirationDate);
      const daysUntilExpiry = Math.floor((expirationDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check if contract is expired
      if (expirationDateObj < now) {
        const workflowEvent: WorkflowEvent = {
          eventId: uuidv4(),
          tenantId: contract.orgId || contract.organizationId,
          type: "contract.expired",
          payload: {
            contractId: contractDoc.id,
            expirationDate,
            ...contract,
          },
          timestamp: FieldValue.serverTimestamp() as any,
        };

        await executionEngine.processEvent(workflowEvent);
        
        logger.info("Triggered workflow for expired contract", {
          contractId: contractDoc.id,
          eventId: workflowEvent.eventId,
        });
      }
      // Check if contract is expiring within 30 days
      else if (expirationDateObj <= thirtyDaysFromNow && expirationDateObj > now) {
        const workflowEvent: WorkflowEvent = {
          eventId: uuidv4(),
          tenantId: contract.orgId || contract.organizationId,
          type: "contract.expiring",
          payload: {
            contractId: contractDoc.id,
            expirationDate,
            daysUntilExpiry,
            ...contract,
          },
          timestamp: FieldValue.serverTimestamp() as any,
        };

        await executionEngine.processEvent(workflowEvent);
        
        logger.info("Triggered workflow for expiring contract", {
          contractId: contractDoc.id,
          eventId: workflowEvent.eventId,
          daysUntilExpiry,
        });
      }
    }
  } catch (error) {
    logger.error("Error checking contract expiry", {
      error: error instanceof Error ? error.message : "Unknown error",
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
