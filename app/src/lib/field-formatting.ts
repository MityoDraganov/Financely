/**
 * Safely parses a number from a string input, allowing empty values.
 * Returns undefined if the input is empty or invalid, preventing default values from being applied.
 * 
 * @param value - The string value from an input field
 * @param allowFloat - Whether to allow floating point numbers (default: true)
 * @returns The parsed number, or undefined if empty/invalid
 * 
 * @example
 * parseNumber("42") // 42
 * parseNumber("42.5") // 42.5
 * parseNumber("") // undefined
 * parseNumber("  ") // undefined
 * parseNumber("abc") // undefined
 */
export function parseNumber(value: string, allowFloat: boolean = true): number | undefined {
	if (!value || value.trim() === "") {
		return undefined;
	}
	
	const trimmed = value.trim();
	const parsed = allowFloat ? parseFloat(trimmed) : parseInt(trimmed, 10);
	
	// Check if parsing resulted in NaN
	if (isNaN(parsed)) {
		return undefined;
	}
	
	return parsed;
}

/**
 * Safely parses an integer from a string input, allowing empty values.
 * Convenience wrapper for parseNumber with allowFloat=false.
 * 
 * @param value - The string value from an input field
 * @returns The parsed integer, or undefined if empty/invalid
 */
export function parseInteger(value: string): number | undefined {
	return parseNumber(value, false);
}






