import type { WidgetBlock, WidgetPage, WidgetVersionActions } from "./entities/widget-block-schema";

function block(
	id: string,
	type: WidgetBlock["type"],
	props: Record<string, unknown>,
	children?: WidgetBlock[]
): WidgetBlock {
	return { id, type, props, ...(children?.length ? { children } : {}) };
}

function page(id: string, name: string, fields: WidgetBlock[]): WidgetPage {
	return { id, name, fields };
}

export const CONTACT_TEMPLATE: {
	name: string;
	pages: WidgetPage[];
	actions: WidgetVersionActions;
} = {
	name: "Contact Form",
	pages: [
		page("contact-p1", "Page 1", [
			block("t-header", "sectionHeader", {
				title: "Contact Us",
				description: "Send us a message and we'll get back to you.",
			}),
			block("t-name", "inputText", {
				label: "Name",
				required: true,
				placeholder: "Your name",
				fieldKey: "name",
			}),
			block("t-email", "email", {
				label: "Email",
				required: true,
				placeholder: "you@example.com",
				fieldKey: "email",
			}),
			block("t-phone", "phone", {
				label: "Phone",
				required: false,
				placeholder: "Your phone",
				fieldKey: "phone",
			}),
			block("t-message", "textarea", {
				label: "Message",
				required: false,
				placeholder: "Your message",
				fieldKey: "message",
			}),
			block("t-submit", "submitButton", { label: "Submit" }),
		]),
	],
	actions: {
		createLead: { enabled: true, tags: ["contact"] },
		success: { message: "Thank you! We'll be in touch soon." },
	},
};

export const QUOTE_TEMPLATE: {
	name: string;
	pages: WidgetPage[];
	actions: WidgetVersionActions;
} = {
	name: "Quote Request",
	pages: [
		page("quote-p1", "Page 1", [
			block("t-header", "sectionHeader", {
				title: "Request a Quote",
				description: "Tell us about your project and we'll send you a quote.",
			}),
			block("t-name", "inputText", {
				label: "Name",
				required: true,
				placeholder: "Your name",
				fieldKey: "name",
			}),
			block("t-email", "email", {
				label: "Email",
				required: true,
				placeholder: "you@example.com",
				fieldKey: "email",
			}),
			block("t-company", "inputText", {
				label: "Company",
				required: false,
				placeholder: "Company name",
				fieldKey: "company",
			}),
			block("t-budget", "select", {
				label: "Budget range",
				fieldKey: "budget",
				options: ["Under $1k", "$1k–$5k", "$5k–$10k", "$10k+"],
			}),
			block("t-notes", "textarea", {
				label: "Project details",
				required: false,
				placeholder: "Describe your project...",
				fieldKey: "message",
			}),
			block("t-submit", "submitButton", { label: "Request Quote" }),
		]),
	],
	actions: {
		createLead: { enabled: true, tags: ["quote_request"] },
		success: { message: "Thanks! We'll send your quote soon." },
	},
};

export const INVOICE_TEMPLATE: {
	name: string;
	pages: WidgetPage[];
	actions: WidgetVersionActions;
} = {
	name: "Invoice Request",
	pages: [
		page("invoice-p1", "Page 1", [
			block("t-header", "sectionHeader", {
				title: "Request an Invoice",
				description: "Provide your details and we'll prepare an invoice.",
			}),
			block("t-company", "inputText", {
				label: "Company name",
				required: true,
				placeholder: "Company name",
				fieldKey: "company",
			}),
			block("t-name", "inputText", {
				label: "Contact name",
				required: true,
				placeholder: "Your name",
				fieldKey: "name",
			}),
			block("t-email", "email", {
				label: "Email",
				required: true,
				placeholder: "billing@company.com",
				fieldKey: "email",
			}),
			block("t-address", "textarea", {
				label: "Billing address",
				required: false,
				placeholder: "Street, city, postal code",
				fieldKey: "billingAddress",
			}),
			block("t-vat", "inputText", {
				label: "VAT number (optional)",
				required: false,
				placeholder: "VAT ID",
				fieldKey: "vatNumber",
			}),
			block("t-notes", "textarea", {
				label: "Notes",
				required: false,
				placeholder: "Any special instructions...",
				fieldKey: "message",
			}),
			block("t-submit", "submitButton", { label: "Request Invoice" }),
		]),
	],
	actions: {
		createLead: { enabled: true, tags: ["invoice_request"] },
		success: { message: "We've received your request. Invoice on the way!" },
	},
};

export const WIDGET_TEMPLATES = [
	{ id: "contact" as const, ...CONTACT_TEMPLATE },
	{ id: "quote" as const, ...QUOTE_TEMPLATE },
	{ id: "invoice" as const, ...INVOICE_TEMPLATE },
];
