import z from "zod";
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
 * - items[0].quantity (array item with nested property)
 * - items[*].total (array wildcard)
 * 
 * Pattern breakdown:
 * - [A-Za-z0-9_]+ - starts with identifier
 * - (?:\[[0-9*]+\])? - optional array index (e.g., [0]) or wildcard [*]
 * - (?:\.[A-Za-z0-9_]+)* - zero or more dot-separated properties
 * - (?:\[[0-9*]+\])? - optional array index after properties (for nested arrays)
 * 
 * Lookahead ensures the reference is followed by valid operators or end of string
 * This allows matching references before comparison operators (>, <, =, etc.)
 */
export const FORMULA_REFERENCE_PATTERN = /([A-Za-z0-9_]+(?:\[[0-9*]+\])?(?:\.[A-Za-z0-9_]+(?:\[[0-9*]+\])?)*)(?=[+\-*/(),<>=!]|$)/g;

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

