import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getDatabaseService } from "../services/database-service";
import { getOrganizationRepository } from "../repositories/organization-repository";
import { getWidgetDefinitionRepository } from "../repositories/widget-definition-repository";
import { getWidgetVersionRepository } from "../repositories/widget-version-repository";
import { getWidgetSubmissionRepository } from "../repositories/widget-submission-repository";
import { getContactRepository } from "../repositories/contact-repository";
import { getLeadRepository } from "../repositories/lead-repository";
import { ContactData } from "../core/entities/contact";
import { LeadData } from "../core/entities/lead";
import { parseBudgetInput } from "../utils/budget";
import {
	getRateLimiter,
	checkRequestSize,
	extractIpFromRequest,
	normalizeOrganizationId,
	normalizeEmail,
	normalizeName,
	normalizePhone,
	MAX_LENGTHS,
} from "../middleware";
import {
	checkHoneypot,
	checkDuplicateSubmission,
	clearDuplicateSubmission,
	hashPayload,
} from "../middleware/abuse-protection";

function buildSubmissionNote(data: Record<string, unknown>, message?: string): string {
	const fields: string[] = [];
	if (data.name || data.firstName || data.lastName) {
		const name =
			(data.name as string) ||
			`${(data.firstName as string) || ""} ${(data.lastName as string) || ""}`.trim();
		if (name) fields.push(`Name: ${name}`);
	}
	if (data.email) fields.push(`Email: ${data.email}`);
	if (data.phone || data.tel) fields.push(`Phone: ${data.phone || data.tel}`);
	if (data.company) fields.push(`Company: ${data.company}`);
	if (data.jobTitle) fields.push(`Job Title: ${data.jobTitle}`);
	if (message) fields.push(`Message: ${message}`);
	Object.entries(data).forEach(([key, value]) => {
		if (
			value !== undefined &&
			value !== null &&
			value !== "" &&
			typeof value !== "boolean"
		) {
			fields.push(`${key}: ${String(value)}`);
		}
	});
	return fields.join("\n");
}

export const submitModularWidget = onRequest(
	{
		region: "us-central1",
		cors: true,
		invoker: "public",
		ingressSettings: "ALLOW_ALL",
	},
	async (request, response) => {
		const FUNCTION_NAME = "submit-modular-widget";
		const ipAddress = extractIpFromRequest(request);
		let duplicateOrgId: string | null = null;
		let duplicatePayloadHash: string | null = null;

		try {
			if (request.method !== "POST") {
				response.status(405).json({ error: "Method not allowed" });
				return;
			}

			const sizeCheck = checkRequestSize(request, FUNCTION_NAME);
			if (!sizeCheck.isValid) {
				response.status(400).json({
					error: sizeCheck.error || "Request too large",
				});
				return;
			}

			const {
				organizationId: rawOrgId,
				widgetId,
				widgetVersionId: rawVersionId,
				data: rawData,
			} = request.body;

			const organizationId = normalizeOrganizationId(rawOrgId);
			if (!organizationId) {
				response.status(400).json({
					error: "organizationId is required and must be a valid identifier",
				});
				return;
			}
			if (!widgetId || typeof widgetId !== "string") {
				response.status(400).json({
					error: "widgetId is required",
				});
				return;
			}
			if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
				response.status(400).json({
					error: "data is required and must be an object",
				});
				return;
			}

			const data = rawData as Record<string, unknown>;
			for (const [k, v] of Object.entries(data)) {
				if (
					typeof v === "boolean" ||
					typeof v === "number" ||
					typeof v === "string"
				) {
					continue;
				}
				data[k] = v == null ? "" : String(v);
			}

			if (checkHoneypot(data)) {
				logger.warn("Spam submission detected (honeypot)", {
					organizationId,
					widgetId,
				});
				response.status(200).json({
					success: true,
					message: "Form submitted successfully",
				});
				return;
			}

			const payloadHash = hashPayload({
				organizationId,
				widgetId,
				...data,
			});
			const isDuplicate = await checkDuplicateSubmission(
				organizationId,
				ipAddress,
				payloadHash,
				60
			);
			if (isDuplicate) {
				logger.info("Duplicate submission rejected", {
					organizationId,
					widgetId,
				});
				response.status(200).json({
					success: true,
					duplicate: true,
					message: "We've already received this submission.",
				});
				return;
			}
			duplicateOrgId = organizationId;
			duplicatePayloadHash = payloadHash;

			const rateLimiter = getRateLimiter();
			const rateLimitResult = await rateLimiter.checkLimit(
				FUNCTION_NAME,
				ipAddress,
				organizationId
			);
			rateLimiter.logRateLimitEvent(
				FUNCTION_NAME,
				rateLimitResult,
				ipAddress,
				organizationId
			);
			if (!rateLimitResult.allowed) {
				response.status(429).json({
					error: "Rate limit exceeded",
					retryAfter: rateLimitResult.resetIn,
				});
				return;
			}

			const databaseService = getDatabaseService();
			const organizationRepository = getOrganizationRepository(databaseService);
			const widgetDefinitionRepository =
				getWidgetDefinitionRepository(databaseService);
			const widgetVersionRepository = getWidgetVersionRepository(databaseService);
			const widgetSubmissionRepository =
				getWidgetSubmissionRepository(databaseService);
			const contactRepository = getContactRepository(databaseService);
			const leadRepository = getLeadRepository(databaseService);

			const organization = await organizationRepository.get({
				id: organizationId,
			});
			if (!organization) {
				response.status(404).json({ error: "Organization not found" });
				return;
			}
			if (organization.status !== "active") {
				response.status(403).json({
					error: "Organization is not active",
				});
				return;
			}

			const definition = await widgetDefinitionRepository.get({
				id: widgetId,
			});
			if (!definition) {
				response.status(404).json({ error: "Widget not found" });
				return;
			}
			const defOrgId = (definition as { orgId: string }).orgId;
			if (defOrgId !== organizationId) {
				response.status(403).json({
					error: "Widget does not belong to this organization",
				});
				return;
			}

			const versionId =
				typeof rawVersionId === "string"
					? rawVersionId
					: (definition as { publishedVersionId: string | null }).publishedVersionId;
			if (!versionId) {
				response.status(400).json({
					error: "Widget has no published version",
				});
				return;
			}

			const version = await widgetVersionRepository.get({
				id: versionId,
			});
			if (!version) {
				response.status(404).json({ error: "Widget version not found" });
				return;
			}
			const versionWidgetId = (version as { widgetId: string }).widgetId;
			if (versionWidgetId !== widgetId) {
				response.status(400).json({
					error: "Version does not belong to this widget",
				});
				return;
			}

			const actions = (version as {
				actions?: {
					createLead?: { enabled: boolean; tags?: string[] };
					success?: { message: string; redirectUrl?: string };
				};
			}).actions ?? {};
			const successMessage =
				typeof actions.success?.message === "string"
					? actions.success.message
					: "Thank you!";
			const redirectUrl =
				typeof actions.success?.redirectUrl === "string"
					? actions.success.redirectUrl
					: undefined;

			let contactId: string | undefined;
			let leadId: string | undefined;

			if (actions.createLead?.enabled) {
				const emailRaw = (data.email as string) || "";
				const email = emailRaw ? normalizeEmail(emailRaw) : null;
				const phoneRaw = (data.phone as string) || (data.tel as string) || "";
				const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
				const nameRaw = (data.name as string) || "";
				const firstNameRaw =
					(data.firstName as string) || (nameRaw.split(" ")[0] || "");
				const lastNameRaw =
					(data.lastName as string) || nameRaw.split(" ").slice(1).join(" ") || "";
				const firstName = normalizeName(firstNameRaw, MAX_LENGTHS.firstName);
				const lastName = normalizeName(lastNameRaw, MAX_LENGTHS.lastName);
				const companyRaw = (data.company as string) || "";
				const company = companyRaw
					? normalizeName(companyRaw, MAX_LENGTHS.company)
					: undefined;
				const jobTitleRaw = (data.jobTitle as string) || "";
				const jobTitle = jobTitleRaw
					? normalizeName(jobTitleRaw, MAX_LENGTHS.jobTitle)
					: undefined;
				const messageRaw =
					(data.message as string) || (data.notes as string) || "";
				const message = messageRaw
					? normalizeName(messageRaw, MAX_LENGTHS.message)
					: undefined;
				const parsedBudget = parseBudgetInput({
					value: data.budget ?? data.estimatedBudget,
					minValue: data.budgetMin,
					maxValue: data.budgetMax,
					currency: data.budgetCurrency ?? data.currency,
				});

				const allContacts = await contactRepository.getAll({
					queryConstraints: [
						{
							field: "organizationId",
							operator: "==",
							value: organizationId,
						},
					],
				});

				const getContactData = (contact: unknown): ContactData => {
					const c = contact as { data?: ContactData } & ContactData;
					return c.data ?? (c as unknown as ContactData);
				};

				let existingContact: (unknown & { id: string }) | null = null;
				if (email) {
					for (const contact of allContacts) {
						const contactData = getContactData(contact);
						const contactEmail = contactData.email
							? normalizeEmail(contactData.email)
							: null;
						if (contactEmail && contactEmail === email) {
							existingContact = contact as unknown & { id: string };
							break;
						}
					}
				}

				const submissionNote = buildSubmissionNote(data, message);
				const tags = actions.createLead.tags ?? ["modular"];

				if (existingContact) {
					const existingContactData = getContactData(existingContact);
					const updateData: Partial<ContactData> = {};
					if (firstName) updateData.firstName = firstName;
					if (lastName) updateData.lastName = lastName;
					if (email) updateData.email = email;
					if (phone) {
						const phoneTrimmed = phone.trim();
						const existingPhones = Array.isArray(existingContactData.phone)
							? existingContactData.phone
							: existingContactData.phone
								? [existingContactData.phone]
								: [];
						if (
							phoneTrimmed &&
							!existingPhones.includes(phoneTrimmed)
						) {
							updateData.phone = [...existingPhones, phoneTrimmed];
						}
					}
					if (company) updateData.company = company;
					if (jobTitle) updateData.jobTitle = jobTitle;
					if (parsedBudget) {
						updateData.budget = parsedBudget.budget;
						updateData.budgetMin = parsedBudget.budgetMin;
						updateData.budgetMax = parsedBudget.budgetMax;
						if (parsedBudget.budgetCurrency) {
							updateData.budgetCurrency = parsedBudget.budgetCurrency;
						}
					}
					updateData.notes = existingContactData.notes
						? `${existingContactData.notes}\n\n--- ${new Date().toISOString()} ---\n${submissionNote}`
						: submissionNote;
					const existingTags = existingContactData.tags ?? [];
					const widgetTag = "widget-modular";
					if (!existingTags.includes(widgetTag)) {
						updateData.tags = [...existingTags, widgetTag];
					}
					await contactRepository.update({
						id: existingContact.id,
						data: updateData,
					});
					contactId = existingContact.id;
				} else {
					if (!email && !phone) {
						response.status(400).json({
							error: "Either email or phone is required",
						});
						return;
					}
					const contactData: ContactData = {
						organizationId,
						firstName: firstName || "",
						lastName: lastName || "",
						email: email || "",
						phone: phone ? [phone] : [],
						...(company ? { company } : {}),
						...(jobTitle ? { jobTitle } : {}),
						...(parsedBudget
							? {
									budget: parsedBudget.budget,
									budgetMin: parsedBudget.budgetMin,
									budgetMax: parsedBudget.budgetMax,
									...(parsedBudget.budgetCurrency
										? { budgetCurrency: parsedBudget.budgetCurrency }
										: {}),
							  }
							: {}),
						notes: submissionNote,
						status: "lead",
						tags: ["widget-submission", "widget-modular"],
						preferences: {
							preferredContactMethod: "email",
							marketingOptIn: false,
							newsletterOptIn: false,
						},
					};
					contactId = await contactRepository.create({
						data: contactData,
					});
				}

				const leadData: LeadData = {
					organizationId,
					contactId,
					widgetType: "modular",
					source: "widget",
					firstName: firstName || undefined,
					lastName: lastName || undefined,
					email: email || undefined,
					phone: phone || undefined,
					...(company ? { company } : {}),
					...(jobTitle ? { jobTitle } : {}),
					...(parsedBudget
						? {
								budget: parsedBudget.budget,
								budgetMin: parsedBudget.budgetMin,
								budgetMax: parsedBudget.budgetMax,
								...(parsedBudget.budgetCurrency
									? { budgetCurrency: parsedBudget.budgetCurrency }
									: {}),
						  }
						: {}),
					formData: data,
					message,
					status: "new",
					tags,
				};
				leadId = await leadRepository.create({ data: leadData });
			}

			await widgetSubmissionRepository.create({
				data: {
					orgId: organizationId,
					widgetId,
					widgetVersionId: versionId,
					payload: data,
					metadata: {
						timestamp: new Date().toISOString(),
					},
					linkedEntities: {
						...(leadId ? { leadId } : {}),
						...(contactId ? { contactId } : {}),
					},
				},
			});
			response.status(200).json({
				success: true,
				message: successMessage,
				...(redirectUrl && { redirectUrl }),
			});
		} catch (error) {
			if (duplicateOrgId && duplicatePayloadHash) {
				try {
					await clearDuplicateSubmission(
						duplicateOrgId,
						ipAddress,
						duplicatePayloadHash,
					);
				} catch (clearError) {
					logger.warn("Failed to clear duplicate submission marker after failed request", {
						organizationId: duplicateOrgId,
						error: clearError instanceof Error ? clearError.message : "Unknown error",
					});
				}
			}
			logger.error("Error processing modular widget submission", {
				error: error instanceof Error ? error.message : "Unknown error",
				body: request.body,
			});
			response.status(500).json({
				error: "We couldn't submit your form right now. Please try again.",
			});
		}
	}
);
