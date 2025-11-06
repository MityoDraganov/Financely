import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getContactRepository } from "../repositories/contact-repository";
import { ContactData } from "../core/entities/contact";

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

      // Handle different widget types
      if (widgetType === "contactForm") {
        // Create contact from form data
        const contactData: ContactData = {
          organizationId,
          firstName: (data.name as string)?.split(" ")[0] || (data.firstName as string) || "",
          lastName: (data.name as string)?.split(" ").slice(1).join(" ") || (data.lastName as string) || "",
          email: (data.email as string) || "",
          phone: (data.phone as string) || (data.tel as string) || undefined,
          company: (data.company as string) || undefined,
          jobTitle: (data.jobTitle as string) || undefined,
          notes: (data.message as string) || (data.notes as string) || undefined,
          status: "lead",
          tags: ["widget-submission", "contact-form"],
          preferences: {
            preferredContactMethod: "email",
            marketingOptIn: false,
            newsletterOptIn: false,
          },
        };

        const contactRepository = getContactRepository(databaseService);
        await contactRepository.create({ data: contactData });

        logger.info("Contact created from widget submission", {
          organizationId,
          email: contactData.email,
        });
      } else if (widgetType === "invoiceRequest" || widgetType === "quoteRequest") {
        // For invoice/quote requests, create a contact with notes
        const contactData: ContactData = {
          organizationId,
          firstName: (data.name as string)?.split(" ")[0] || (data.firstName as string) || "",
          lastName: (data.name as string)?.split(" ").slice(1).join(" ") || (data.lastName as string) || "",
          email: (data.email as string) || "",
          phone: (data.phone as string) || (data.tel as string) || undefined,
          company: (data.company as string) || undefined,
          notes: `[${widgetType === "invoiceRequest" ? "Invoice Request" : "Quote Request"}] ${JSON.stringify(data)}`,
          status: "lead",
          tags: ["widget-submission", widgetType],
          preferences: {
            preferredContactMethod: "email",
            marketingOptIn: false,
            newsletterOptIn: false,
          },
        };

        const contactRepository = getContactRepository(databaseService);
        await contactRepository.create({ data: contactData });

        logger.info(`${widgetType} created from widget submission`, {
          organizationId,
          email: contactData.email,
        });
      }

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

