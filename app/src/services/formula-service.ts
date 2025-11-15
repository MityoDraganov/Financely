import { FORMULA_FUNCTIONS, FORMULA_REFERENCE_PATTERN, type Formula } from "@/core/entities/formula";
import type { TemplateElement } from "@/core";

/**
 * Formula evaluation service
 * Evaluates Excel-like formulas with field references
 */
export class FormulaService {
	/**
	 * Extract field references from a formula
	 * Returns array of referenced field bindings or element IDs
	 */
	static extractReferences(formula: string): string[] {
		if (!formula || !formula.trim().startsWith("=")) return [];
		
		const references: string[] = [];
		const matches = formula.matchAll(FORMULA_REFERENCE_PATTERN);
		
		for (const match of matches) {
			const ref = match[1];
			// Skip function names and numbers
			if (this.isFunctionName(ref) || !isNaN(Number(ref))) continue;
			if (!references.includes(ref)) {
				references.push(ref);
			}
		}
		
		return references;
	}

	/**
	 * Check if a string is a function name
	 */
	private static isFunctionName(name: string): boolean {
		return name in FORMULA_FUNCTIONS;
	}

	/**
	 * Resolve a field reference to its value
	 * Supports:
	 * - Element ID references (e.g., "element-123")
	 * - Binding path references (e.g., "items.total", "invoice.subtotal")
	 * - Array item references (e.g., "items[0].price")
	 */
	static resolveReference(
		reference: string,
		formData: Record<string, unknown>,
		elements?: TemplateElement[],
		elementValues?: Map<string, number>
	): number {
		// Try element ID reference first
		if (elements && elementValues) {
			const element = elements.find((el) => el.id === reference);
			if (element) {
				const value = elementValues.get(reference);
				if (value !== undefined) return Number(value) || 0;
			}
		}

		// Try binding path reference
		const parts = reference.split(".");
		let current: unknown = formData;
		
		for (const part of parts) {
			// Handle array indices like items[0]
			const arrayMatch = part.match(/^([^\[]+)\[(\d+)\]$/);
			if (arrayMatch) {
				const arrayName = arrayMatch[1];
				const index = parseInt(arrayMatch[2], 10);
				if (current && typeof current === "object" && arrayName in current) {
					const array = (current as Record<string, unknown>)[arrayName];
					if (Array.isArray(array) && array[index] !== undefined) {
						current = array[index];
						continue;
					}
				}
				return 0;
			}
			
			// Handle object property access
			if (current && typeof current === "object" && part in current) {
				current = (current as Record<string, unknown>)[part];
			} else {
				return 0;
			}
		}
		
		// Convert final value to number
		if (typeof current === "number") return current;
		if (typeof current === "string") {
			const num = Number(current);
			return isNaN(num) ? 0 : num;
		}
		return 0;
	}

	/**
	 * Evaluate a formula expression
	 * Supports Excel-like syntax with functions and operators
	 */
	static evaluate(
		formula: Formula | string | undefined,
		formData: Record<string, unknown>,
		elements?: TemplateElement[],
		elementValues?: Map<string, number>
	): number {
		if (!formula || formula.trim() === "") return 0;
		
		const expression = formula.trim();
		if (!expression.startsWith("=")) {
			// Not a formula, try to parse as number
			const num = Number(expression);
			return isNaN(num) ? 0 : num;
		}

		// Remove the leading =
		const formulaBody = expression.slice(1).trim();
		
		try {
			return this.evaluateExpression(formulaBody, formData, elements, elementValues);
		} catch (error) {
			console.error("Formula evaluation error:", error, { formula, formData });
			return 0;
		}
	}

	/**
	 * Evaluate a formula expression (without the = prefix)
	 */
	private static evaluateExpression(
		expression: string,
		formData: Record<string, unknown>,
		elements?: TemplateElement[],
		elementValues?: Map<string, number>
	): number {
		// Handle function calls (e.g., SUM(A1, B1))
		const functionMatch = expression.match(/^([A-Z]+)\((.+)\)$/);
		if (functionMatch) {
			const functionName = functionMatch[1] as keyof typeof FORMULA_FUNCTIONS;
			const argsStr = functionMatch[2];
			
			if (functionName in FORMULA_FUNCTIONS) {
				// Parse arguments (handle nested parentheses)
				const args = this.parseFunctionArguments(argsStr);
				const evaluatedArgs = args.map((arg) =>
					this.evaluateExpression(arg.trim(), formData, elements, elementValues)
				);
				// Type assertion for spread operator - functions accept number[] and return number or unknown
				const func = FORMULA_FUNCTIONS[functionName] as (...args: number[]) => number | unknown;
				const result = func(...evaluatedArgs);
				return Number(result) || 0;
			}
		}

		// Handle arithmetic expressions (e.g., A1 + B1, A1 * 1.1)
		// Replace field references with their values
		let processedExpression = expression;
		const references = this.extractReferences(expression);
		
		for (const ref of references) {
			const value = this.resolveReference(ref, formData, elements, elementValues);
			// Replace reference with its value (handle word boundaries to avoid partial matches)
			processedExpression = processedExpression.replace(
				new RegExp(`\\b${this.escapeRegex(ref)}\\b`, "g"),
				String(value)
			);
		}

		// Evaluate the arithmetic expression
		try {
			// Use Function constructor for safe evaluation (only math operations)
			// This is safer than eval() but still allows arithmetic operations
			const result = this.safeEvaluate(processedExpression);
			return Number(result) || 0;
		} catch (error) {
			console.error("Expression evaluation error:", error, { expression, processedExpression });
			return 0;
		}
	}

	/**
	 * Parse function arguments, handling nested parentheses
	 */
	private static parseFunctionArguments(argsStr: string): string[] {
		const args: string[] = [];
		let current = "";
		let depth = 0;
		
		for (let i = 0; i < argsStr.length; i++) {
			const char = argsStr[i];
			if (char === "(") {
				depth++;
				current += char;
			} else if (char === ")") {
				depth--;
				current += char;
			} else if (char === "," && depth === 0) {
				args.push(current.trim());
				current = "";
			} else {
				current += char;
			}
		}
		
		if (current.trim()) {
			args.push(current.trim());
		}
		
		return args;
	}

	/**
	 * Safe evaluation of arithmetic expressions
	 * Only allows numbers, operators, and parentheses
	 */
	private static safeEvaluate(expression: string): number {
		// Remove all whitespace
		const cleaned = expression.replace(/\s/g, "");
		
		// Validate: only numbers, operators, parentheses, and decimal points
		if (!/^[0-9+\-*/().\s]+$/.test(cleaned)) {
			throw new Error("Invalid expression: contains non-numeric or non-operator characters");
		}
		
		// Use Function constructor for safe evaluation
		try {
			return new Function(`return ${cleaned}`)() as number;
		} catch {
			// Fallback to basic parsing for simple cases
			return this.basicEvaluate(cleaned);
		}
	}

	/**
	 * Basic arithmetic evaluation (fallback)
	 */
	private static basicEvaluate(expression: string): number {
		// Handle parentheses first
		let processed = expression;
		while (processed.includes("(")) {
			const match = processed.match(/\(([^()]+)\)/);
			if (!match) break;
			const innerResult = this.basicEvaluate(match[1]);
			processed = processed.replace(match[0], String(innerResult));
		}
		
		// Handle multiplication and division
		while (processed.match(/[\d.]+[*/][\d.]+/)) {
			processed = processed.replace(/([\d.]+)\s*([*/])\s*([\d.]+)/, (_, a, op, b) => {
				return op === "*" ? String(Number(a) * Number(b)) : String(Number(a) / Number(b));
			});
		}
		
		// Handle addition and subtraction
		while (processed.match(/[\d.]+[+-][\d.]+/)) {
			processed = processed.replace(/([\d.]+)\s*([+-])\s*([\d.]+)/, (_, a, op, b) => {
				return op === "+" ? String(Number(a) + Number(b)) : String(Number(a) - Number(b));
			});
		}
		
		return Number(processed) || 0;
	}

	/**
	 * Escape special regex characters
	 */
	private static escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	/**
	 * Validate formula syntax
	 */
	static validate(formula: string): { valid: boolean; error?: string } {
		if (!formula || formula.trim() === "") {
			return { valid: true };
		}
		
		if (!formula.trim().startsWith("=")) {
			return { valid: false, error: "Formula must start with '='" };
		}
		
		try {
			// Try to extract references to validate syntax
			this.extractReferences(formula);
			return { valid: true };
		} catch (error) {
			return {
				valid: false,
				error: error instanceof Error ? error.message : "Invalid formula syntax",
			};
		}
	}
}

