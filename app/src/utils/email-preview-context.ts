import type { Contact, EmailTemplatePlaceholder, Invoice, Product, Proposal } from "@/core";
import {
	normalizeInvoiceStatus,
	normalizeProposalStatus,
	INVOICE_STATUSES,
	PROPOSAL_STATUSES,
} from "@/core";
import type { DynamicSourceEntity, DynamicSourceField } from "@/utils/dynamic-sources";

type DynamicPlaceholderSource = {
	entity: DynamicSourceEntity;
	path: string;
};

type PreviewDefaultsInput = {
	placeholders: EmailTemplatePlaceholder[];
	usedPlaceholderKeys: Set<string>;
	products: Product[];
	contacts: Contact[];
	invoices: Invoice[];
	proposals: Proposal[];
	dynamicSourceByPlaceholderKey: Record<string, DynamicSourceField>;
};

type PreviewDefaultsResult = {
	productId?: string;
	contactId?: string;
	invoiceId?: string;
	proposalId?: string;
};

type PreviewValueInput = {
	placeholders: EmailTemplatePlaceholder[];
	usedPlaceholderKeys: Set<string>;
	selectedProduct?: Product;
	selectedContact?: Contact;
	selectedInvoice?: Invoice;
	selectedProposal?: Proposal;
	selectedProductMetafieldsByDefinitionId?: Record<string, unknown>;
	selectedContactMetafieldsByDefinitionId?: Record<string, unknown>;
	dynamicSourceByPlaceholderKey: Record<string, DynamicSourceField>;
};

const METAFIELD_PATH_PREFIX = "metafields.";

const getMetafieldDefinitionIdFromPath = (path: string): string | null => {
	if (!path.startsWith(METAFIELD_PATH_PREFIX)) {
		return null;
	}
	const definitionId = path.slice(METAFIELD_PATH_PREFIX.length).trim();
	return definitionId.length > 0 ? definitionId : null;
};

const PRODUCT_HEURISTIC_FIELDS = [
	"name",
	"description",
	"price",
	"currency",
	"category",
	"sku",
	"images",
];

const CONTACT_HEURISTIC_FIELDS = [
	"firstName",
	"lastName",
	"email",
	"phone",
	"company",
	"jobTitle",
	"address.city",
];

const INVOICE_HEURISTIC_FIELDS = [
	"status",
	"invoiceNumber",
	"number",
	"issueDate",
	"dueDate",
	"buyer.name",
	"seller.name",
	"total",
	"currency",
];

const PROPOSAL_HEURISTIC_FIELDS = [
	"title",
	"description",
	"status",
	"items",
	"subtotal",
	"taxTotal",
	"total",
	"currency",
];

const INVOICE_AMOUNT_FIELDS = [
	"grossTotal",
	"total",
	"totalAmount",
	"grandTotal",
	"amount",
	"netAmount",
];

const toTimeValue = (value?: string) => {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
};

const toSentenceCase = (value: string) =>
	value
		.split(/[_\s-]+/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
		.join(" ");

const toDisplayString = (value: unknown): string => {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) {
		const joined = value
			.map((entry) => toDisplayString(entry))
			.filter((entry) => entry.trim().length > 0)
			.join(", ");
		return joined;
	}
	if (typeof value === "object") {
		const target = value as Record<string, unknown>;
		const prioritizedKeys = ["name", "title", "label", "description", "value", "text"];
		for (const key of prioritizedKeys) {
			const candidate = target[key];
			const formatted = toDisplayString(candidate);
			if (formatted.trim().length > 0) {
				return formatted;
			}
		}
	}
	return "";
};

const getRecordFieldAsString = (value: unknown): string => {
	if (typeof value === "string") {
		return value.trim();
	}
	if (Array.isArray(value)) {
		const firstString = value.find((entry) => typeof entry === "string");
		return typeof firstString === "string" ? firstString.trim() : "";
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return "";
};

const toNumberValue = (value: unknown): number | undefined => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value.replace(/[^0-9.-]/g, ""));
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return undefined;
};

const formatCurrencyAmount = (amount: number, currency?: string): string => {
	const resolvedCurrency = currency?.trim().toUpperCase() || "USD";
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency: resolvedCurrency,
			maximumFractionDigits: 2,
		}).format(amount);
	} catch {
		return `${amount} ${resolvedCurrency}`;
	}
};

const getContactRecordData = (contact?: Contact): Record<string, unknown> => {
	if (!contact || typeof contact !== "object") {
		return {};
	}

	const contactWithOptionalData = contact as unknown as {
		data?: unknown;
	};
	if (
		contactWithOptionalData.data &&
		typeof contactWithOptionalData.data === "object" &&
		!Array.isArray(contactWithOptionalData.data)
	) {
		return contactWithOptionalData.data as Record<string, unknown>;
	}

	// Backward compatibility for legacy flat contact records.
	return contact as unknown as Record<string, unknown>;
};

const getNestedValue = (source: unknown, path: string): unknown => {
	if (!source || !path) return undefined;
	const pathSegments = path.split(".").filter(Boolean);
	let current: unknown = source;
	for (const segment of pathSegments) {
		if (current === null || current === undefined) {
			return undefined;
		}
		if (Array.isArray(current)) {
			const index = Number(segment);
			if (Number.isNaN(index)) {
				return undefined;
			}
			current = current[index];
			continue;
		}
		if (typeof current !== "object") {
			return undefined;
		}
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
};

const getInvoiceValueByPath = (invoice: Invoice | undefined, path: string): unknown => {
	if (!invoice || !path) return undefined;
	const normalizedPath = path.trim().toLowerCase();
	const hostedInvoiceUrl = invoice.payment?.hostedInvoiceUrl?.trim();
	const fallbackInvoiceUrl = hostedInvoiceUrl || invoice.pdfUrl;
	const normalizedStatus = normalizeInvoiceStatus(invoice.status);
	const paymentStatus =
		normalizedStatus === INVOICE_STATUSES.PAID
			? "paid"
			: normalizedStatus === INVOICE_STATUSES.CANCELLED
				? "cancelled"
				: hostedInvoiceUrl
					? "payable_online"
					: "payable_fallback";
	const paymentReference =
		getRecordFieldAsString(
			getNestedValue(invoice.data, "reference") ??
				getNestedValue(invoice.data, "invoiceNumber") ??
				getNestedValue(invoice.data, "number"),
		) || invoice.id;

	if (normalizedPath === "paymentdelivery.status") {
		return paymentStatus;
	}
	if (normalizedPath === "paymentdelivery.hasonlinelink") {
		return Boolean(hostedInvoiceUrl);
	}
	if (normalizedPath === "paymentdelivery.reference") {
		return paymentReference;
	}
	if (normalizedPath === "paymentdelivery.payurl") {
		return hostedInvoiceUrl || "";
	}
	if (normalizedPath === "paymentdelivery.viewurl") {
		return fallbackInvoiceUrl;
	}
	if (normalizedPath === "paymentdelivery.pdfurl") {
		return invoice.pdfUrl;
	}
	if (normalizedPath === "paymentdelivery.warningtext") {
		return paymentStatus === "payable_fallback"
			? "Online payment link is unavailable. Fallback payment instructions will be used."
			: "";
	}
	if (normalizedPath === "paymentdelivery.fallbackinstructions") {
		return "Online payment is unavailable. Use the provided bank transfer details and payment reference.";
	}

	if (
		normalizedPath === "payurl" ||
		normalizedPath === "viewurl" ||
		normalizedPath === "invoiceurl" ||
		normalizedPath === "links.payurl" ||
		normalizedPath === "links.viewurl" ||
		normalizedPath === "payment.hostedinvoiceurl"
	) {
		return fallbackInvoiceUrl;
	}
	if (normalizedPath === "links.pdfurl") {
		return invoice.pdfUrl;
	}

	const candidatePaths = (() => {
		const normalized = path.trim();
		if (!normalized) return [] as string[];

		const aliasGroups: Array<[string, string[]]> = [
			["buyer.", ["buyer.", "customer.", "client."]],
			["customer.", ["customer.", "buyer.", "client."]],
			["client.", ["client.", "customer.", "buyer."]],
		];

		for (const [prefix, replacements] of aliasGroups) {
			if (!normalized.startsWith(prefix)) continue;
			const suffix = normalized.slice(prefix.length);
			return replacements.map((replacement) => `${replacement}${suffix}`);
		}

		return [normalized];
	})();

	for (const candidatePath of candidatePaths) {
		if (candidatePath.startsWith("data.")) {
			const value = getNestedValue(invoice.data, candidatePath.slice(5));
			if (value !== undefined) {
				return value;
			}
			continue;
		}

		const directValue = getNestedValue(invoice, candidatePath);
		if (directValue !== undefined) {
			return directValue;
		}

		const dataValue = getNestedValue(invoice.data, candidatePath);
		if (dataValue !== undefined) {
			return dataValue;
		}
	}

	return undefined;
};

const getInvoiceCurrency = (invoice: Invoice): string => {
	const value =
		getRecordFieldAsString(getInvoiceValueByPath(invoice, "currency")) ||
		getRecordFieldAsString(getInvoiceValueByPath(invoice, "data.currency"));
	return value.trim().toUpperCase() || "USD";
};

const getInvoiceAmount = (invoice: Invoice): number | undefined => {
	for (const field of INVOICE_AMOUNT_FIELDS) {
		const parsed = toNumberValue(getInvoiceValueByPath(invoice, field));
		if (parsed !== undefined) {
			return parsed;
		}
	}
	return undefined;
};

const isPopulated = (value: unknown) => {
	if (value === null || value === undefined) return false;
	if (typeof value === "string") return value.trim().length > 0;
	if (typeof value === "number") return Number.isFinite(value);
	if (typeof value === "boolean") return true;
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
	return false;
};

const getPlaceholderSource = (
	placeholder: EmailTemplatePlaceholder,
	dynamicSourceByPlaceholderKey: Record<string, DynamicSourceField>,
): DynamicPlaceholderSource | null => {
	if (placeholder.source?.type === "entity_field") {
		return {
			entity: placeholder.source.entity,
			path: placeholder.source.path,
		};
	}

	const fallback = dynamicSourceByPlaceholderKey[placeholder.key.toLowerCase()];
	if (!fallback) return null;

	return {
		entity: fallback.entity,
		path: fallback.path,
	};
};

const collectRequiredPaths = (
	placeholders: EmailTemplatePlaceholder[],
	usedPlaceholderKeys: Set<string>,
	dynamicSourceByPlaceholderKey: Record<string, DynamicSourceField>,
) => {
	const requiredPathsByEntity: Record<DynamicSourceEntity, Set<string>> = {
		product: new Set<string>(),
		contact: new Set<string>(),
		invoice: new Set<string>(),
		proposal: new Set<string>(),
	};
	const usedKeysLower = new Set(Array.from(usedPlaceholderKeys).map((key) => key.toLowerCase()));

	placeholders.forEach((placeholder) => {
		if (!usedKeysLower.has(placeholder.key.toLowerCase())) {
			return;
		}
		const source = getPlaceholderSource(placeholder, dynamicSourceByPlaceholderKey);
		if (!source) return;
		if (source.path.startsWith(METAFIELD_PATH_PREFIX)) {
			return;
		}
		requiredPathsByEntity[source.entity].add(source.path);
	});

	return {
		productPaths: Array.from(requiredPathsByEntity.product),
		contactPaths: Array.from(requiredPathsByEntity.contact),
		invoicePaths: Array.from(requiredPathsByEntity.invoice),
		proposalPaths: Array.from(requiredPathsByEntity.proposal),
	};
};

const scoreProduct = (product: Product, requiredPaths: string[]) => {
	let score = 0;
	requiredPaths.forEach((path) => {
		score += isPopulated(getNestedValue(product, path)) ? 8 : -3;
	});

	PRODUCT_HEURISTIC_FIELDS.forEach((path) => {
		score += isPopulated(getNestedValue(product, path)) ? 2 : 0;
	});

	if (product.status === "active") {
		score += 3;
	}
	if (Array.isArray(product.images) && product.images.length > 0) {
		score += 2;
	}
	if ((product.stockQuantity ?? 0) > 0) {
		score += 1;
	}

	return score;
};

const scoreContact = (contact: Contact, requiredPaths: string[]) => {
	let score = 0;
	const contactData = getContactRecordData(contact);
	requiredPaths.forEach((path) => {
		score += isPopulated(getNestedValue(contactData, path)) ? 8 : -3;
	});

	CONTACT_HEURISTIC_FIELDS.forEach((path) => {
		score += isPopulated(getNestedValue(contactData, path)) ? 2 : 0;
	});

	const status = getRecordFieldAsString(contactData.status);
	if (status === "customer" || status === "active") {
		score += 3;
	}

	return score;
};

const scoreInvoice = (invoice: Invoice, requiredPaths: string[]) => {
	let score = 0;
	requiredPaths.forEach((path) => {
		score += isPopulated(getInvoiceValueByPath(invoice, path)) ? 8 : -3;
	});

	INVOICE_HEURISTIC_FIELDS.forEach((path) => {
		score += isPopulated(getInvoiceValueByPath(invoice, path)) ? 2 : 0;
	});

	const normalizedStatus = normalizeInvoiceStatus(invoice.status);
	if (normalizedStatus === INVOICE_STATUSES.PAID) {
		score += 4;
	} else if (normalizedStatus === INVOICE_STATUSES.SENT) {
		score += 2;
	}

	if ((getInvoiceAmount(invoice) ?? 0) > 0) {
		score += 2;
	}

	return score;
};

const scoreProposal = (proposal: Proposal, requiredPaths: string[]) => {
	let score = 0;
	requiredPaths.forEach((path) => {
		score += isPopulated(getNestedValue(proposal, path)) ? 8 : -3;
	});

	PROPOSAL_HEURISTIC_FIELDS.forEach((path) => {
		score += isPopulated(getNestedValue(proposal, path)) ? 2 : 0;
	});

	const normalizedStatus = normalizeProposalStatus(proposal.status);
	if (normalizedStatus === PROPOSAL_STATUSES.ACCEPTED) {
		score += 4;
	} else if (normalizedStatus === PROPOSAL_STATUSES.SENT) {
		score += 2;
	} else if (normalizedStatus === PROPOSAL_STATUSES.INVOICED) {
		score += 2;
	}

	if ((proposal.items?.length ?? 0) > 0) {
		score += 2;
	}

	if ((proposal.total ?? 0) > 0) {
		score += 2;
	}

	return score;
};

const pickBestProduct = (products: Product[], requiredPaths: string[]) => {
	if (products.length === 0) return undefined;
	return [...products].sort((left, right) => {
		const scoreDiff = scoreProduct(right, requiredPaths) - scoreProduct(left, requiredPaths);
		if (scoreDiff !== 0) return scoreDiff;
		const recencyDiff =
			toTimeValue(right.updatedAt) + toTimeValue(right.createdAt) -
			(toTimeValue(left.updatedAt) + toTimeValue(left.createdAt));
		if (recencyDiff !== 0) return recencyDiff;
		return (right.name || "").localeCompare(left.name || "");
	})[0];
};

const pickBestContact = (contacts: Contact[], requiredPaths: string[]) => {
	if (contacts.length === 0) return undefined;
	return [...contacts].sort((left, right) => {
		const scoreDiff = scoreContact(right, requiredPaths) - scoreContact(left, requiredPaths);
		if (scoreDiff !== 0) return scoreDiff;
		const recencyDiff =
			toTimeValue(right.updatedAt) + toTimeValue(right.createdAt) -
			(toTimeValue(left.updatedAt) + toTimeValue(left.createdAt));
		if (recencyDiff !== 0) return recencyDiff;
		const leftData = getContactRecordData(left);
		const rightData = getContactRecordData(right);
		const leftLabel = `${getRecordFieldAsString(leftData.firstName)} ${getRecordFieldAsString(
			leftData.lastName,
		)}`.trim();
		const rightLabel = `${getRecordFieldAsString(rightData.firstName)} ${getRecordFieldAsString(
			rightData.lastName,
		)}`.trim();
		return rightLabel.localeCompare(leftLabel);
	})[0];
};

const pickBestInvoice = (invoices: Invoice[], requiredPaths: string[]) => {
	if (invoices.length === 0) return undefined;
	return [...invoices].sort((left, right) => {
		const scoreDiff = scoreInvoice(right, requiredPaths) - scoreInvoice(left, requiredPaths);
		if (scoreDiff !== 0) return scoreDiff;
		const recencyDiff =
			toTimeValue(right.updatedAt) + toTimeValue(right.createdAt) -
			(toTimeValue(left.updatedAt) + toTimeValue(left.createdAt));
		if (recencyDiff !== 0) return recencyDiff;
		const rightLabel = getRecordFieldAsString(getInvoiceValueByPath(right, "invoiceNumber"));
		const leftLabel = getRecordFieldAsString(getInvoiceValueByPath(left, "invoiceNumber"));
		return rightLabel.localeCompare(leftLabel);
	})[0];
};

const pickBestProposal = (proposals: Proposal[], requiredPaths: string[]) => {
	if (proposals.length === 0) return undefined;
	return [...proposals].sort((left, right) => {
		const scoreDiff = scoreProposal(right, requiredPaths) - scoreProposal(left, requiredPaths);
		if (scoreDiff !== 0) return scoreDiff;
		const recencyDiff =
			toTimeValue(right.updatedAt) + toTimeValue(right.createdAt) -
			(toTimeValue(left.updatedAt) + toTimeValue(left.createdAt));
		if (recencyDiff !== 0) return recencyDiff;
		return (right.title || "").localeCompare(left.title || "");
	})[0];
};

export function chooseDefaultPreviewRecordIds({
	placeholders,
	usedPlaceholderKeys,
	products,
	contacts,
	invoices,
	proposals,
	dynamicSourceByPlaceholderKey,
}: PreviewDefaultsInput): PreviewDefaultsResult {
	const { productPaths, contactPaths, invoicePaths, proposalPaths } = collectRequiredPaths(
		placeholders,
		usedPlaceholderKeys,
		dynamicSourceByPlaceholderKey,
	);

	const bestProduct = pickBestProduct(products, productPaths);
	const bestContact = pickBestContact(contacts, contactPaths);
	const bestInvoice = pickBestInvoice(invoices, invoicePaths);
	const bestProposal = pickBestProposal(proposals, proposalPaths);

	return {
		productId: bestProduct?.id,
		contactId: bestContact?.id,
		invoiceId: bestInvoice?.id,
		proposalId: bestProposal?.id,
	};
}

export function buildPreviewPlaceholderValues({
	placeholders,
	usedPlaceholderKeys,
	selectedProduct,
	selectedContact,
	selectedInvoice,
	selectedProposal,
	selectedProductMetafieldsByDefinitionId,
	selectedContactMetafieldsByDefinitionId,
	dynamicSourceByPlaceholderKey,
}: PreviewValueInput): Record<string, string> {
	const values: Record<string, string> = {};
	const usedKeysLower = new Set(Array.from(usedPlaceholderKeys).map((key) => key.toLowerCase()));

	placeholders.forEach((placeholder) => {
		const placeholderKey = placeholder.key.toLowerCase();
		if (!usedKeysLower.has(placeholderKey)) {
			return;
		}

		const source = getPlaceholderSource(placeholder, dynamicSourceByPlaceholderKey);
		if (!source) return;

		let rawValue: unknown;
		if (source.entity === "product") {
			const metafieldDefinitionId = getMetafieldDefinitionIdFromPath(source.path);
			if (metafieldDefinitionId) {
				rawValue = selectedProductMetafieldsByDefinitionId?.[metafieldDefinitionId];
			} else {
				rawValue = getNestedValue(selectedProduct, source.path);
			}
		}
		if (source.entity === "contact") {
			const metafieldDefinitionId = getMetafieldDefinitionIdFromPath(source.path);
			if (metafieldDefinitionId) {
				rawValue = selectedContactMetafieldsByDefinitionId?.[metafieldDefinitionId];
			} else {
				rawValue = getNestedValue(getContactRecordData(selectedContact), source.path);
			}
		}
		if (source.entity === "invoice") {
			rawValue = getInvoiceValueByPath(selectedInvoice, source.path);
		}
		if (source.entity === "proposal") {
			rawValue = getNestedValue(selectedProposal, source.path);
		}

		const formatted = toDisplayString(rawValue);
		if (!formatted.trim()) return;

		values[placeholderKey] = formatted;
	});

	return values;
}

export const formatProductPreviewLabel = (product: Product) => {
	const parts: string[] = [];
	if (product.name?.trim()) {
		parts.push(product.name.trim());
	}
	if (typeof product.price === "number") {
		const currency = product.currency?.trim().toUpperCase() || "USD";
		parts.push(formatCurrencyAmount(product.price, currency));
	}
	if (product.status) {
		parts.push(toSentenceCase(product.status));
	}
	return parts.filter(Boolean).join(" • ") || product.id;
};

export const formatContactPreviewLabel = (contact: Contact) => {
	const contactData = getContactRecordData(contact);
	const fullName = `${getRecordFieldAsString(contactData.firstName)} ${getRecordFieldAsString(
		contactData.lastName,
	)}`.trim();
	const parts: string[] = [];
	if (fullName) {
		parts.push(fullName);
	}
	const email = getRecordFieldAsString(contactData.email);
	if (email) {
		parts.push(email);
	}
	const company = getRecordFieldAsString(contactData.company);
	if (company) {
		parts.push(company);
	}
	return parts.filter(Boolean).join(" • ") || contact.id;
};

export const formatInvoicePreviewLabel = (invoice: Invoice) => {
	const invoiceNumber =
		getRecordFieldAsString(getInvoiceValueByPath(invoice, "invoiceNumber")) ||
		getRecordFieldAsString(getInvoiceValueByPath(invoice, "number"));
	const amount = getInvoiceAmount(invoice);
	const currency = getInvoiceCurrency(invoice);
	const parts: string[] = [];

	if (invoiceNumber) {
		parts.push(invoiceNumber);
	}
	if (amount !== undefined) {
		parts.push(formatCurrencyAmount(amount, currency));
	}
	parts.push(toSentenceCase(normalizeInvoiceStatus(invoice.status)));

	return parts.filter(Boolean).join(" • ") || invoice.id;
};

export const formatProposalPreviewLabel = (proposal: Proposal) => {
	const parts: string[] = [];
	if (proposal.title?.trim()) {
		parts.push(proposal.title.trim());
	}
	if (typeof proposal.total === "number") {
		parts.push(formatCurrencyAmount(proposal.total, proposal.currency));
	}
	parts.push(toSentenceCase(normalizeProposalStatus(proposal.status)));
	return parts.filter(Boolean).join(" • ") || proposal.id;
};
