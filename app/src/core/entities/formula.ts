import z from "zod";

/**
 * Formula expression schema
 * Supports Excel-like formulas with field references
 * Examples:
 * - =SUM(A1, B1)
 * - =A1 + B1
 * - =A1 * 1.1
 * - =SUM(items.total)
 * - =items.total * 0.2
 */
export const formulaSchema = z.string().refine(
	(val) => {
		if (!val || val.trim() === "") return true; // Empty is valid (no formula)
		// Formula must start with =
		if (!val.trim().startsWith("=")) return false;
		// Basic validation - more complex validation in the evaluator
		return true;
	},
	{ message: "Formula must start with '='" }
);

export type Formula = z.infer<typeof formulaSchema>;

/**
 * Formula reference pattern
 * Matches field references like:
 * - A1 (element ID reference)
 * - items.total (binding path)
 * - items[0].price (array item binding)
 */
export const FORMULA_REFERENCE_PATTERN = /([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*(?:\[[0-9]+\])?)/g;

/**
 * Supported formula functions
 */
export const FORMULA_FUNCTIONS = {
	SUM: (...args: number[]): number => {
		return args.reduce((sum, val) => sum + (Number(val) || 0), 0);
	},
	AVERAGE: (...args: number[]): number => {
		if (args.length === 0) return 0;
		const sum = args.reduce((sum, val) => sum + (Number(val) || 0), 0);
		return sum / args.length;
	},
	MIN: (...args: number[]): number => {
		if (args.length === 0) return 0;
		return Math.min(...args.map((val) => Number(val) || 0));
	},
	MAX: (...args: number[]): number => {
		if (args.length === 0) return 0;
		return Math.max(...args.map((val) => Number(val) || 0));
	},
	COUNT: (...args: unknown[]): number => {
		return args.filter((val) => val != null && val !== "").length;
	},
	ROUND: (value: number, decimals: number = 0): number => {
		return Math.round(Number(value) * Math.pow(10, decimals)) / Math.pow(10, decimals);
	},
	IF: (condition: boolean, trueValue: unknown, falseValue: unknown): unknown => {
		return condition ? trueValue : falseValue;
	},
	ABS: (value: number): number => {
		return Math.abs(Number(value));
	},
	MULTIPLY: (...args: number[]): number => {
		return args.reduce((product, val) => product * (Number(val) || 1), 1);
	},
	DIVIDE: (dividend: number, divisor: number): number => {
		if (Number(divisor) === 0) return 0;
		return Number(dividend) / Number(divisor);
	},
} as const;

export type FormulaFunction = keyof typeof FORMULA_FUNCTIONS;

