import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getContactRepository } from "../repositories/contact-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { ContactData } from "../core/entities/contact";
import { LeadData } from "../core/entities/lead";

/**
 * Build a formatted note from form submission data
 */
function buildSubmissionNote(
  widgetType: string,
  data: Record<string, unknown>,
  message?: string,
): string {
  if (widgetType === "contactForm") {
    // For contact forms, include all fields in a readable format
    const fields: string[] = [];
    
    // Standard fields
    if (data.name || data.firstName || data.lastName) {
      const name = (data.name as string) || `${(data.firstName as string) || ""} ${(data.lastName as string) || ""}`.trim();
      if (name) fields.push(`Name: ${name}`);
    }
    if (data.email) fields.push(`Email: ${data.email}`);
    if (data.phone || data.tel) fields.push(`Phone: ${data.phone || data.tel}`);
    if (data.company) fields.push(`Company: ${data.company}`);
    if (data.jobTitle) fields.push(`Job Title: ${data.jobTitle}`);
    if (message) fields.push(`Message: ${message}`);
    
    // Custom fields (exclude standard fields already processed)
    const standardFields = new Set(["name", "firstName", "lastName", "email", "phone", "tel", "company", "jobTitle", "message", "notes"]);
    Object.entries(data).forEach(([key, value]) => {
      if (!standardFields.has(key) && value !== undefined && value !== null && value !== "") {
        fields.push(`${key}: ${String(value)}`);
      }
    });
    
    return fields.join("\n");
  } else {
    // For invoice/quote requests, use a simpler format
    const prefix = widgetType === "invoiceRequest" ? "Invoice Request" : "Quote Request";
    return `[${prefix}]\n${message || JSON.stringify(data, null, 2)}`;
  }
}

/**
 * Public API endpoint to submit widget form data.
 * This endpoint handles submissions from embeddable widgets.
 * 
 * POST /submitWidgetForm
 * 
 * Body:
 * {
 *   organizationId: string,
 *   widgetType: "contactForm" | "invoiceRequest" | "quoteRequest",
 *   data: Record<string, unknown>
 * }
 */
export const submitWidgetForm = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public",
    ingressSettings: "ALLOW_ALL",
  },
  async (request, response) => {
    try {
      if (request.method !== "POST") {
        response.status(405).json({ error: "Method not allowed" });
        return;
      }

      const { organizationId, widgetType, data } = request.body;

      if (!organizationId || typeof organizationId !== "string") {
        response.status(400).json({
          error: "organizationId is required",
        });
        return;
      }

      if (!widgetType || !["contactForm", "invoiceRequest", "quoteRequest"].includes(widgetType)) {
        response.status(400).json({
          error: "widgetType must be one of: contactForm, invoiceRequest, quoteRequest",
        });
        return;
      }

      if (!data || typeof data !== "object") {
        response.status(400).json({
          error: "data is required and must be an object",
        });
        return;
      }

      logger.info("Processing widget form submission", {
        organizationId,
        widgetType,
      });

      const databaseService = getDatabaseService();
      const organizationRepository = getOrganizationRepository(databaseService);

      const organization = await organizationRepository.get({ id: organizationId });

      if (!organization) {
        response.status(404).json({
          error: "Organization not found",
        });
        return;
      }

      if (organization.status !== "active") {
        response.status(403).json({
          error: "Organization is not active",
        });
        return;
      }

      // Check if widget is enabled
      const widgets = organization.settings?.widgets;
      if (!widgets?.enabled) {
        response.status(403).json({
          error: "Widgets are not enabled for this organization",
        });
        return;
      }

      const widgetConfig = widgets[widgetType as keyof typeof widgets];
      if (!widgetConfig || !(widgetConfig as { enabled?: boolean }).enabled) {
        response.status(403).json({
          error: `Widget type ${widgetType} is not enabled`,
        });
        return;
      }

      // Extract contact information from form data
      const email = (data.email as string) || "";
      const phone = (data.phone as string) || (data.tel as string) || "";
      const firstName = (data.name as string)?.split(" ")[0] || (data.firstName as string) || "";
      const lastName = (data.name as string)?.split(" ").slice(1).join(" ") || (data.lastName as string) || "";
      const company = (data.company as string) || undefined;
      const jobTitle = (data.jobTitle as string) || undefined;
      const message = (data.message as string) || (data.notes as string) || undefined;

      const contactRepository = getContactRepository(databaseService);
      const leadRepository = getLeadRepository(databaseService);

      // Check for existing contact by email or phone
      let existingContact = null;
      let contactId: string | undefined = undefined;

      if (email) {
        const contactsByEmail = await contactRepository.getAll({
          queryConstraints: [
            {
              field: "data.organizationId",
              operator: "==",
              value: organizationId,
            },
            {
              field: "data.email",
              operator: "==",
              value: email,
            },
          ],
        });
        if (contactsByEmail.length > 0) {
          existingContact = contactsByEmail[0];
        }
      }

      // If not found by email, check by phone
      if (!existingContact && phone) {
        const contactsByPhone = await contactRepository.getAll({
          queryConstraints: [
            {
              field: "data.organizationId",
              operator: "==",
              value: organizationId,
            },
            {
              field: "data.phone",
              operator: "==",
              value: phone,
            },
          ],
        });
        if (contactsByPhone.length > 0) {
          existingContact = contactsByPhone[0];
        }
      }

      // Create or update contact
      if (existingContact) {
        // Update existing contact - merge new data with existing
        const updateData: Partial<ContactData> = {};
        
        // Only update fields that are provided and not already set
        if (firstName && !existingContact.data.firstName) {
          updateData.firstName = firstName;
        }
        if (lastName && !existingContact.data.lastName) {
          updateData.lastName = lastName;
        }
        if (email && existingContact.data.email !== email) {
          updateData.email = email;
        }
        if (phone && !existingContact.data.phone) {
          updateData.phone = phone;
        }
        if (company && !existingContact.data.company) {
          updateData.company = company;
        }
        if (jobTitle && !existingContact.data.jobTitle) {
          updateData.jobTitle = jobTitle;
        }

        // Append new submission data to notes
        const existingNotes = existingContact.data.notes || "";
        const submissionNote = buildSubmissionNote(widgetType, data, message);
        updateData.notes = existingNotes 
          ? `${existingNotes}\n\n--- ${new Date().toISOString()} ---\n${submissionNote}`
          : submissionNote;

        // Add widget submission tag if not already present
        const existingTags = existingContact.data.tags || [];
        const widgetTag = `widget-${widgetType}`;
        if (!existingTags.includes(widgetTag)) {
          updateData.tags = [...existingTags, widgetTag];
        }

        await contactRepository.update({
          id: existingContact.id,
          data: updateData,
        });

        contactId = existingContact.id;

        logger.info("Contact updated from widget submission", {
          organizationId,
          contactId: existingContact.id,
          email,
        });
      } else {
        // Create new contact
        const contactData: ContactData = {
          organizationId,
          firstName: firstName || "",
          lastName: lastName || "",
          email: email || "",
          phone: phone || undefined,
          company,
          jobTitle,
          notes: buildSubmissionNote(widgetType, data, message),
          status: "lead",
          tags: ["widget-submission", `widget-${widgetType}`],
          preferences: {
            preferredContactMethod: "email",
            marketingOptIn: false,
            newsletterOptIn: false,
          },
        };

        const newContactId = await contactRepository.create({ data: contactData });
        contactId = newContactId;

        logger.info("Contact created from widget submission", {
          organizationId,
          contactId: newContactId,
          email,
        });
      }

      // Always create a new lead record to track this individual submission
      const leadData: LeadData = {
        organizationId,
        contactId,
        widgetType,
        source: "widget",
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        company,
        jobTitle,
        formData: data as Record<string, unknown>,
        message,
        status: "new",
        tags: [widgetType],
      };

      const leadId = await leadRepository.create({ data: leadData });

      logger.info("Lead created from widget submission", {
        organizationId,
        leadId,
        contactId,
        widgetType,
      });

      response.status(200).json({
        success: true,
        message: "Form submitted successfully",
      });
    } catch (error) {
      logger.error("Error processing widget form submission", {
        error: error instanceof Error ? error.message : "Unknown error",
        body: request.body,
      });

      response.status(500).json({
        error: "Internal server error",
      });
    }
  },
);

