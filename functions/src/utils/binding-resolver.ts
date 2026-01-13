import { DataContext, DataContextValue } from "../core/entities/data-context";

export function resolveBinding(
  context: DataContext,
  path: string
): DataContextValue | null {
  if (!path) {
    return null;
  }

  const parts: string[] = [];
  let currentPart = "";
  let inBrackets = false;

  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    if (char === "[") {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = "";
      }
      inBrackets = true;
      currentPart += char;
    } else if (char === "]") {
      currentPart += char;
      parts.push(currentPart);
      currentPart = "";
      inBrackets = false;
    } else if (char === "." && !inBrackets) {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = "";
      }
    } else {
      currentPart += char;
    }
  }
  if (currentPart) {
    parts.push(currentPart);
  }

  if (parts.length === 0) {
    return null;
  }

  let current: unknown = context;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return null;
    }

    if (part.startsWith("[") && part.endsWith("]")) {
      if (!Array.isArray(current)) {
        return null;
      }
      const indexStr = part.slice(1, -1);
      if (indexStr === "*") {
        return current as DataContextValue;
      }
      const index = parseInt(indexStr, 10);
      if (isNaN(index) || index < 0 || index >= (current as unknown[]).length) {
        return null;
      }
      current = (current as unknown[])[index];
    } else {
      if (Array.isArray(current)) {
        return null;
      }
      const obj = current as Record<string, unknown>;
      if (!(part in obj)) {
        return null;
      }
      current = obj[part];
    }
  }

  if (
    typeof current === "string" ||
    typeof current === "number" ||
    typeof current === "boolean" ||
    current === null ||
    current === undefined ||
    Array.isArray(current) ||
    (typeof current === "object" && current !== null)
  ) {
    return current as DataContextValue;
  }

  return null;
}

