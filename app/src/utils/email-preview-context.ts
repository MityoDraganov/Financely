import type { Contact, EmailTemplatePlaceholder, Product } from "@/core";
import type { DynamicSourceField } from "@/utils/dynamic-sources";

type DynamicPlaceholderSource = {
	entity: "product" | "contact";
	path: string;
};

type PreviewDefaultsInput = {
	placeholders: EmailTemplatePlaceholder[];
	usedPlaceholderKeys: Set<string>;
	products: Product[];
	contacts: Contact[];
	dynamicSourceByPlaceholderKey: Record<string, DynamicSourceField>;
};

type PreviewDefaultsResult = {
	productId?: string;
	contactId?: string;
};

type PreviewValueInput = {
	placeholders: EmailTemplatePlaceholder[];
	usedPlaceholderKeys: Set<string>;
	selectedProduct?: Product;
	selectedContact?: Contact;
	dynamicSourceByPlaceholderKey: Record<string, DynamicSourceField>;
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

const toTimeValue = (value?: string) => {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
};

const toSentenceCase = (value: string) =>
	value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

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
	return "";
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
	const productPaths = new Set<string>();
	const contactPaths = new Set<string>();
	const usedKeysLower = new Set(Array.from(usedPlaceholderKeys).map((key) => key.toLowerCase()));

	placeholders.forEach((placeholder) => {
		if (!usedKeysLower.has(placeholder.key.toLowerCase())) {
			return;
		}
		const source = getPlaceholderSource(placeholder, dynamicSourceByPlaceholderKey);
		if (!source) return;
		if (source.entity === "product") {
			productPaths.add(source.path);
		}
		if (source.entity === "contact") {
			contactPaths.add(source.path);
		}
	});

	return {
		productPaths: Array.from(productPaths),
		contactPaths: Array.from(contactPaths),
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

export function chooseDefaultPreviewRecordIds({
	placeholders,
	usedPlaceholderKeys,
	products,
	contacts,
	dynamicSourceByPlaceholderKey,
}: PreviewDefaultsInput): PreviewDefaultsResult {
	const { productPaths, contactPaths } = collectRequiredPaths(
		placeholders,
		usedPlaceholderKeys,
		dynamicSourceByPlaceholderKey,
	);

	const bestProduct = pickBestProduct(products, productPaths);
	const bestContact = pickBestContact(contacts, contactPaths);

	return {
		productId: bestProduct?.id,
		contactId: bestContact?.id,
	};
}

export function buildPreviewPlaceholderValues({
	placeholders,
	usedPlaceholderKeys,
	selectedProduct,
	selectedContact,
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
			rawValue = getNestedValue(selectedProduct, source.path);
		}
		if (source.entity === "contact") {
			rawValue = getNestedValue(getContactRecordData(selectedContact), source.path);
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
		try {
			parts.push(
				new Intl.NumberFormat(undefined, {
					style: "currency",
					currency,
					maximumFractionDigits: 2,
				}).format(product.price),
			);
		} catch {
			parts.push(`${product.price} ${currency}`);
		}
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
