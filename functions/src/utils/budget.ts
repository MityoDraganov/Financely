import type { BudgetValue } from "../core/entities/budget";

export type ParsedBudgetInput = {
	budget: BudgetValue;
	budgetMin: number;
	budgetMax: number;
	budgetCurrency?: string;
};

const parseNumericToken = (value: unknown): number | undefined => {
	if (typeof value === "number") {
		return Number.isFinite(value) && value >= 0 ? value : undefined;
	}
	if (typeof value !== "string") return undefined;

	const token = value.trim().toLowerCase();
	if (!token) return undefined;

	const multiplierMatch = token.match(/^([-+]?[\d.,]+)\s*([kmb])$/i);
	if (multiplierMatch) {
		const base = Number(multiplierMatch[1].replace(/,/g, ""));
		if (!Number.isFinite(base) || base < 0) return undefined;
		const multiplier =
			multiplierMatch[2].toLowerCase() === "k"
				? 1_000
				: multiplierMatch[2].toLowerCase() === "m"
					? 1_000_000
					: 1_000_000_000;
		return base * multiplier;
	}

	const normalized = token.replace(/[^\d.,-]/g, "").replace(/,/g, "");
	if (!normalized) return undefined;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const parseRangeToken = (value: string): { minAmount: number; maxAmount: number } | undefined => {
	const normalized = value.trim().toLowerCase();
	if (!normalized) return undefined;

	const underMatch = normalized.match(/^under\s+(.+)$/);
	if (underMatch) {
		const maxAmount = parseNumericToken(underMatch[1]);
		if (maxAmount == null) return undefined;
		return { minAmount: 0, maxAmount };
	}

	const overMatch = normalized.match(/^(over|above)\s+(.+)$/);
	if (overMatch) {
		const minAmount = parseNumericToken(overMatch[2]);
		if (minAmount == null) return undefined;
		return { minAmount, maxAmount: minAmount };
	}

	const plusMatch = normalized.match(/^(.+)\+$/);
	if (plusMatch) {
		const minAmount = parseNumericToken(plusMatch[1]);
		if (minAmount == null) return undefined;
		return { minAmount, maxAmount: minAmount };
	}

	const splitByRange = normalized.split(/\s*(?:-|–|—|\bto\b)\s*/i).filter(Boolean);
	if (splitByRange.length === 2) {
		const minAmount = parseNumericToken(splitByRange[0]);
		const maxAmount = parseNumericToken(splitByRange[1]);
		if (minAmount == null || maxAmount == null || maxAmount < minAmount) {
			return undefined;
		}
		return { minAmount, maxAmount };
	}

	return undefined;
};

const sanitizeCurrency = (currency: unknown): string | undefined => {
	if (typeof currency !== "string") return undefined;
	const trimmed = currency.trim().toUpperCase();
	return trimmed || undefined;
};

export const parseBudgetInput = ({
	value,
	minValue,
	maxValue,
	currency,
}: {
	value?: unknown;
	minValue?: unknown;
	maxValue?: unknown;
	currency?: unknown;
}): ParsedBudgetInput | undefined => {
	const parsedCurrency = sanitizeCurrency(currency);

	const parsedMin = parseNumericToken(minValue);
	const parsedMax = parseNumericToken(maxValue);
	if (parsedMin != null && parsedMax != null && parsedMax >= parsedMin) {
		return {
			budget: {
				kind: "range",
				minAmount: parsedMin,
				maxAmount: parsedMax,
				...(parsedCurrency ? { currency: parsedCurrency } : {}),
			},
			budgetMin: parsedMin,
			budgetMax: parsedMax,
			...(parsedCurrency ? { budgetCurrency: parsedCurrency } : {}),
		};
	}

	if (value && typeof value === "object") {
		const obj = value as {
			kind?: unknown;
			amount?: unknown;
			minAmount?: unknown;
			maxAmount?: unknown;
			currency?: unknown;
		};
		const objectCurrency = sanitizeCurrency(obj.currency) ?? parsedCurrency;
		if (obj.kind === "exact") {
			const amount = parseNumericToken(obj.amount);
			if (amount == null) return undefined;
			return {
				budget: {
					kind: "exact",
					amount,
					...(objectCurrency ? { currency: objectCurrency } : {}),
				},
				budgetMin: amount,
				budgetMax: amount,
				...(objectCurrency ? { budgetCurrency: objectCurrency } : {}),
			};
		}
		if (obj.kind === "range") {
			const minAmount = parseNumericToken(obj.minAmount);
			const maxAmount = parseNumericToken(obj.maxAmount);
			if (minAmount == null || maxAmount == null || maxAmount < minAmount) {
				return undefined;
			}
			return {
				budget: {
					kind: "range",
					minAmount,
					maxAmount,
					...(objectCurrency ? { currency: objectCurrency } : {}),
				},
				budgetMin: minAmount,
				budgetMax: maxAmount,
				...(objectCurrency ? { budgetCurrency: objectCurrency } : {}),
			};
		}
	}

	if (typeof value === "string") {
		const parsedRange = parseRangeToken(value);
		if (parsedRange) {
			return {
				budget: {
					kind: "range",
					minAmount: parsedRange.minAmount,
					maxAmount: parsedRange.maxAmount,
					...(parsedCurrency ? { currency: parsedCurrency } : {}),
				},
				budgetMin: parsedRange.minAmount,
				budgetMax: parsedRange.maxAmount,
				...(parsedCurrency ? { budgetCurrency: parsedCurrency } : {}),
			};
		}
	}

	const exactAmount = parseNumericToken(value);
	if (exactAmount != null) {
		return {
			budget: {
				kind: "exact",
				amount: exactAmount,
				...(parsedCurrency ? { currency: parsedCurrency } : {}),
			},
			budgetMin: exactAmount,
			budgetMax: exactAmount,
			...(parsedCurrency ? { budgetCurrency: parsedCurrency } : {}),
		};
	}

	return undefined;
};
