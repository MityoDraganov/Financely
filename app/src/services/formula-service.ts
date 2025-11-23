import { FORMULA_FUNCTIONS, type Formula } from "@/core/entities/formula";
import type { TemplateElement } from "@/core";

/**
 * Formula evaluation service
 * Evaluates Excel-like formulas with field references
 */
export class FormulaService {
  /**
   * Extract field references from a formula
   * Example matches:
   * - netAmount
   * - vatTotal
   * - items[0].quantity
   * - items[*].total
   */
  static extractReferences(formula: string): string[] {
    if (!formula) return [];

    const expression = formula.trim().startsWith("=")
      ? formula.trim().slice(1).trim()
      : formula.trim();

    if (!expression) return [];

    // Extract ANY identifier-like token: words with optional dots and brackets
    const matches = expression.match(/[A-Za-z_][A-Za-z0-9_.\[\]]*/g) ?? [];

    const unique = [...new Set(matches)]
      .filter((ref) => !this.isFunctionName(ref)) // skip function names (IF, SUM, etc.)
      .filter((ref) => isNaN(Number(ref))); // skip pure numbers

    return unique;
  }

  private static isFunctionName(name: string): boolean {
    return name in FORMULA_FUNCTIONS;
  }

  /**
   * Resolve a field reference to its value
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
      const arrayMatch = part.match(/^([^[]+)\[(\d+)\]$/);
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

      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return 0;
      }
    }

    if (typeof current === "number") return current;
    if (typeof current === "string") {
      const num = Number(current);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  /**
   * Evaluate a formula expression
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
      const num = Number(expression);
      return isNaN(num) ? 0 : num;
    }

    const formulaBody = expression.slice(1).trim();

    try {
      return this.evaluateExpression(
        formulaBody,
        formData,
        elements,
        elementValues
      );
    } catch (error) {
      console.error("Formula evaluation error:", error, { formula, formData });
      return 0;
    }
  }

  /**
   * Evaluate a formula expression (without the = prefix)
   * Uses recursive approach: find innermost function calls, evaluate them, replace, repeat
   */
  private static evaluateExpression(
    expression: string,
    formData: Record<string, unknown>,
    elements?: TemplateElement[],
    elementValues?: Map<string, number>
  ): number {
    const trimmed = expression.trim();

    // Early return for simple numbers
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num) && trimmed.match(/^-?\d+(\.\d+)?$/)) {
      return num;
    }

    if (!trimmed) return 0;

    // Step 1: Replace all function calls recursively (innermost first)
    let processed = trimmed;
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 50) {
      iterations++;
      changed = false;

      // Find the innermost function call (one with no nested function calls)
      const innermostCall = this.findInnermostFunctionCall(processed);

      if (innermostCall) {
        const result = this.evaluateFunctionCall(
          innermostCall,
          formData,
          elements,
          elementValues
        );

        // Replace the function call with its result
        const before = processed;
        processed =
          processed.substring(0, innermostCall.start) +
          String(result) +
          processed.substring(innermostCall.end);
        changed = processed !== before;
      } else {
        break;
      }
    }

    // Step 2: Replace all field references with their values
    processed = this.replaceReferences(
      processed,
      formData,
      elements,
      elementValues
    );

    // Step 3: Evaluate the final arithmetic expression
    return this.safeEvaluate(processed);
  }

  /**
   * Find the innermost function call (one with no nested function calls inside)
   */
  private static findInnermostFunctionCall(
    expression: string
  ): { start: number; end: number; fullMatch: string } | null {
    let bestMatch: { start: number; end: number; fullMatch: string } | null =
      null;

    // Find all function calls
    for (let i = 0; i < expression.length; i++) {
      const funcMatch = expression.substring(i).match(/^([A-Z]+)\(/);
      if (!funcMatch) continue;

      const functionName = funcMatch[1];
      if (!(functionName in FORMULA_FUNCTIONS)) continue;

      // Check character before (must not be alphanumeric)
      if (i > 0 && /[A-Za-z0-9_]/.test(expression[i - 1])) continue;

      // Find matching closing parenthesis
      let depth = 1;
      let j = i + funcMatch[0].length;

      while (depth > 0 && j < expression.length) {
        if (expression[j] === "(") depth++;
        else if (expression[j] === ")") depth--;
        j++;
      }

      if (depth === 0) {
        const fullMatch = expression.substring(i, j);
        const innerContent = expression.substring(
          i + funcMatch[0].length,
          j - 1
        );

        // Check if this function call contains any nested function calls
        const hasNestedCalls = /[A-Z]+\s*\(/.test(innerContent);

        // If no nested calls, this is a candidate for innermost
        if (!hasNestedCalls) {
          // Prefer this one if we don't have one yet, or if it's more nested (starts later)
          if (!bestMatch || i > bestMatch.start) {
            bestMatch = { start: i, end: j, fullMatch };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Evaluate a single function call
   */
  private static evaluateFunctionCall(
    call: { start: number; end: number; fullMatch: string },
    formData: Record<string, unknown>,
    elements?: TemplateElement[],
    elementValues?: Map<string, number>
  ): number {
    const fullMatch = call.fullMatch;
    const funcMatch = fullMatch.match(/^([A-Z]+)\((.+)\)$/);
    if (!funcMatch) return 0;

    const functionName = funcMatch[1] as keyof typeof FORMULA_FUNCTIONS;
    const argsStr = funcMatch[2];

    if (!(functionName in FORMULA_FUNCTIONS)) return 0;

    // Parse arguments
    const args = this.parseFunctionArguments(argsStr);

    // Expand array wildcards
    const expandedArgs: string[] = [];
    for (const arg of args) {
      const trimmedArg = arg.trim();
      const wildcardMatch =
        trimmedArg.match(/^([A-Za-z0-9_]+)\[(\*)\](\.?[A-Za-z0-9_]+)*$/);

      if (wildcardMatch) {
        const arrayName = wildcardMatch[1];
        const restOfPath = trimmedArg.substring(
          trimmedArg.indexOf("]") + 1
        ); // after [*]
        const arrayValue = formData[arrayName];
        if (Array.isArray(arrayValue) && arrayValue.length > 0) {
          for (let i = 0; i < arrayValue.length; i++) {
            expandedArgs.push(`${arrayName}[${i}]${restOfPath}`);
          }
        } else {
          expandedArgs.push(`${arrayName}[0]${restOfPath}`);
        }
      } else {
        expandedArgs.push(trimmedArg);
      }
    }

    // Special handling for IF function
    if (functionName === "IF" && expandedArgs.length >= 3) {
      const condition = this.evaluateBooleanExpression(
        expandedArgs[0].trim(),
        formData,
        elements,
        elementValues
      );
      const trueValue = this.evaluateExpression(
        expandedArgs[1].trim(),
        formData,
        elements,
        elementValues
      );
      const falseValue = this.evaluateExpression(
        expandedArgs[2].trim(),
        formData,
        elements,
        elementValues
      );
      return condition ? trueValue : falseValue;
    }

    // Evaluate arguments and call function
    const evaluatedArgs = expandedArgs.map((arg) =>
      this.evaluateExpression(arg.trim(), formData, elements, elementValues)
    );
    const func = FORMULA_FUNCTIONS[functionName] as (
      ...args: number[]
    ) => number | unknown;
    const result = func(...evaluatedArgs);
    return Number(result) || 0;
  }

  /**
   * Replace all field references with their values
   */
  private static replaceReferences(
    expression: string,
    formData: Record<string, unknown>,
    elements?: TemplateElement[],
    elementValues?: Map<string, number>
  ): string {
    let result = expression;

    const references = this.extractReferences(expression).sort(
      (a, b) => b.length - a.length
    ); // longest first

    for (const ref of references) {
      const value = this.resolveReference(ref, formData, elements, elementValues);
      const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // Match whole identifier (including dots/brackets) as a token
      const pattern = new RegExp(`\\b${escaped}\\b`, "g");

      result = result.replace(pattern, String(value));
    }

    return result;
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
   * Evaluate a boolean expression
   */
  private static evaluateBooleanExpression(
    expression: string,
    formData: Record<string, unknown>,
    elements?: TemplateElement[],
    elementValues?: Map<string, number>
  ): boolean {
    // Replace references first
    let processed = this.replaceReferences(
      expression,
      formData,
      elements,
      elementValues
    );

    // Remove whitespace
    processed = processed.replace(/\s+/g, "");

    // Validate: only numbers, arithmetic, and comparison operators allowed
    if (!/^[0-9+\-*/().<>=!]+$/.test(processed)) {
      console.warn(
        "Invalid boolean expression after replacement:",
        expression,
        "→",
        processed
      );
      return false;
    }

    // Normalize operators
    processed = processed.replace(/<>/g, "!=");
    processed = processed.replace(/>=/g, "__GE__");
    processed = processed.replace(/<=/g, "__LE__");
    processed = processed.replace(/==/g, "__EQ__");
    processed = processed.replace(/!=/g, "__NE__");
    processed = processed.replace(/=/g, "==");
    processed = processed.replace(/__GE__/g, ">=");
    processed = processed.replace(/__LE__/g, "<=");
    processed = processed.replace(/__EQ__/g, "==");
    processed = processed.replace(/__NE__/g, "!=");

    try {
      return new Function(`return ${processed}`)() as boolean;
    } catch {
      console.warn(
        "Boolean evaluation failed for expression:",
        expression,
        "→",
        processed
      );
      return false;
    }
  }

  /**
   * Safe evaluation of arithmetic expressions
   */
  private static safeEvaluate(expression: string): number {
    const cleaned = expression.replace(/\s/g, "");

    // Only numbers, basic operators, and parentheses
    if (!/^[0-9+\-*/().]+$/.test(cleaned)) {
      throw new Error("Invalid expression: contains non-numeric or non-operator characters");
    }

    try {
      return new Function(`return ${cleaned}`)() as number;
    } catch {
      return this.basicEvaluate(cleaned);
    }
  }

  /**
   * Basic arithmetic evaluation (fallback)
   */
  private static basicEvaluate(expression: string): number {
    let processed = expression;

    // Handle parentheses
    while (processed.includes("(")) {
      const match = processed.match(/\(([^()]+)\)/);
      if (!match) break;
      const innerResult = this.basicEvaluate(match[1]);
      processed = processed.replace(match[0], String(innerResult));
    }

    // Handle multiplication and division
    while (processed.match(/[\d.]+[*/][\d.]+/)) {
      processed = processed.replace(
        /([\d.]+)\s*([*/])\s*([\d.]+)/,
        (_, a, op, b) => {
          return op === "*"
            ? String(Number(a) * Number(b))
            : String(Number(a) / Number(b));
        }
      );
    }

    // Handle addition and subtraction
    while (processed.match(/[\d.]+[+-][\d.]+/)) {
      processed = processed.replace(
        /([\d.]+)\s*([+-])\s*([\d.]+)/,
        (_, a, op, b) => {
          return op === "+"
            ? String(Number(a) + Number(b))
            : String(Number(a) - Number(b));
        }
      );
    }

    return Number(processed) || 0;
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
      this.extractReferences(formula);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error:
          error instanceof Error ? error.message : "Invalid formula syntax",
      };
    }
  }
}
