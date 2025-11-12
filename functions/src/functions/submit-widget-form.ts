import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getContactRepository } from "../repositories/contact-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { ContactData } from "../core/entities/contact";
import { LeadData } from "../core/entities/lead";

function buildSubmissionNote(
	widgetType: string,
	data: Record<string, unknown>,
	message?: string
): string {
	if (widgetType === "contactForm") {
		const fields: string[] = [];

		if (data.name || data.firstName || data.lastName) {
			const name =
				(data.name as string) ||
				`${(data.firstName as string) || ""} ${
					(data.lastName as string) || ""
				}`.trim();
			if (name) fields.push(`Name: ${name}`);
		}
		if (data.email) fields.push(`Email: ${data.email}`);
		if (data.phone || data.tel)
			fields.push(`Phone: ${data.phone || data.tel}`);
		if (data.company) fields.push(`Company: ${data.company}`);
		if (data.jobTitle) fields.push(`Job Title: ${data.jobTitle}`);
		if (message) fields.push(`Message: ${message}`);
		const standardFields = new Set([
			"name",
			"firstName",
			"lastName",
			"email",
			"phone",
			"tel",
			"company",
			"jobTitle",
			"message",
			"notes",
		]);
		Object.entries(data).forEach(([key, value]) => {
			if (
				!standardFields.has(key) &&
				value !== undefined &&
				value !== null &&
				value !== ""
			) {
				fields.push(`${key}: ${String(value)}`);
			}
		});

		return fields.join("\n");
	} else {
		const prefix =
			widgetType === "invoiceRequest"
				? "Invoice Request"
				: "Quote Request";
		return `[${prefix}]\n${message || JSON.stringify(data, null, 2)}`;
	}
}

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

			if (
				!widgetType ||
				!["contactForm", "invoiceRequest", "quoteRequest"].includes(
					widgetType
				)
			) {
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
			const organizationRepository =
				getOrganizationRepository(databaseService);

			const organization = await organizationRepository.get({
				id: organizationId,
			});

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
			if (
				!widgetConfig ||
				!(widgetConfig as { enabled?: boolean }).enabled
			) {
				response.status(403).json({
					error: `Widget type ${widgetType} is not enabled`,
				});
				return;
			}

			// Extract contact information from form data
			const email = ((data.email as string) || "").trim().toLowerCase();
			const phone = (
				(data.phone as string) ||
				(data.tel as string) ||
				""
			).trim();
			const firstName =
				(data.name as string)?.split(" ")[0] ||
				(data.firstName as string) ||
				"";
			const lastName =
				(data.name as string)?.split(" ").slice(1).join(" ") ||
				(data.lastName as string) ||
				"";
			const company = (data.company as string) || undefined;
			const jobTitle = (data.jobTitle as string) || undefined;
			const message =
				(data.message as string) || (data.notes as string) || undefined;

			const contactRepository = getContactRepository(databaseService);
			const leadRepository = getLeadRepository(databaseService);

			let existingContact = null;
			let contactId: string | undefined = undefined;

			const allContacts = await contactRepository.getAll({
				queryConstraints: [
					{
						field: "organizationId",
						operator: "==",
						value: organizationId,
					},
				],
			});

			// Helper to extract contact data (handles both nested and flat structures)
			const getContactData = (contact: unknown): ContactData => {
				const c = contact as { data?: ContactData } & ContactData;
				return c.data || (c as unknown as ContactData);
			};

			// Check for existing contact by normalized email (primary identifier)
			// Email is the primary identifier - if email matches, we update the contact
			// We do NOT create duplicates based on email
			if (email) {
				const emailNormalized = email.trim().toLowerCase();
				for (const contact of allContacts) {
					const contactData = getContactData(contact);
					const contactEmail = (contactData.email || "")
						.trim()
						.toLowerCase();
					
					// Match by email (case-insensitive, normalized) - PRIMARY MATCH
					if (contactEmail === emailNormalized) {
						existingContact = contact;
						break;
					}
				}
			}

			if (existingContact) {
				const getContactData = (contact: unknown): ContactData => {
					const c = contact as { data?: ContactData } & ContactData;
					return c.data || (c as unknown as ContactData);
				};
				const existingContactData = getContactData(existingContact);

				const updateData: Partial<ContactData> = {};

				if (firstName) {
					updateData.firstName = firstName;
				}
				if (lastName) {
					updateData.lastName = lastName;
				}
				if (email) {
					updateData.email = email;
				}
				
				// Handle multiple phone numbers - merge new phone if different
				if (phone) {
					const phoneTrimmed = phone.trim();
					const existingPhones = Array.isArray(existingContactData.phone)
						? existingContactData.phone
						: existingContactData.phone
						? [existingContactData.phone]
						: [];
					
					// Add new phone if it's different and not already in the list
					if (phoneTrimmed && !existingPhones.includes(phoneTrimmed)) {
						updateData.phone = [...existingPhones, phoneTrimmed];
					}
				}
				
				if (company) {
					updateData.company = company;
				}
				if (jobTitle) {
					updateData.jobTitle = jobTitle;
				}

				const existingNotes = existingContactData.notes || "";
				const submissionNote = buildSubmissionNote(
					widgetType,
					data,
					message
				);
				updateData.notes = existingNotes
					? `${existingNotes}\n\n--- ${new Date().toISOString()} ---\n${submissionNote}`
					: submissionNote;

				const existingTags = existingContactData.tags || [];
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
					phone: phone || "no phone",
				});
			} else {
				const contactData: ContactData = {
					organizationId,
					firstName: firstName || "",
					lastName: lastName || "",
					email: email || "",
					phone: phone?.trim() ? [phone.trim()] : [],
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

				const newContactId = await contactRepository.create({
					data: contactData,
				});
				contactId = newContactId;

				logger.info("Contact created from widget submission", {
					organizationId,
					contactId: newContactId,
					email: email || "no email",
					phone: phone || "no phone",
				});
			}

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

			try {
				const leadId = await leadRepository.create({ data: leadData });
				logger.info("Lead created from widget submission", {
					organizationId,
					leadId,
					contactId: contactId || "no contact",
					widgetType,
					email: email || "no email",
					phone: phone || "no phone",
				});
			} catch (leadError) {
				// Log error but don't fail the request - contact was already created/updated
				logger.error("Failed to create lead record", {
					error:
						leadError instanceof Error
							? leadError.message
							: "Unknown error",
					errorStack:
						leadError instanceof Error
							? leadError.stack
							: undefined,
					organizationId,
					contactId: contactId || "no contact",
					widgetType,
					leadData,
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
	}
);
