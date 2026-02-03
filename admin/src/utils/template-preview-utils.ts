/**
 * Utility functions for template preview rendering
 */

export function getByPath<T>(obj: unknown, path: string): T | null {
  if (!obj || !path) return null;

  const parts = path.split(".");
  let current: unknown = obj;

  for (const key of parts) {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return null;
    }
  }

  return current as T;
}

export function formatAddress(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const addr = value as Record<string, unknown>;
  const parts: string[] = [];

  if (addr.street && typeof addr.street === "string") parts.push(addr.street);
  if (addr.city && typeof addr.city === "string") parts.push(addr.city);
  if (addr.state && typeof addr.state === "string") parts.push(addr.state);
  if (addr.zipCode && typeof addr.zipCode === "string") parts.push(addr.zipCode);
  if (addr.country && typeof addr.country === "string") parts.push(addr.country);

  return parts.filter(Boolean).join(", ") || "";
}

export function formatValue(
  value: unknown,
  kind: "none" | "currency" | "date",
  currency?: string,
  dateFormat?: string
): string {
  if (value == null) return "";

  if (typeof value === "object" && !Array.isArray(value) && kind === "none") {
    const obj = value as Record<string, unknown>;
    if (obj.street || obj.city || obj.state || obj.zipCode || obj.country) {
      return formatAddress(value);
    }
    return Object.entries(obj)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ");
  }

  if (kind === "none") return String(value);

  if (kind === "currency") {
    const num = Number(value);
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    });
    return Number.isFinite(num) ? formatter.format(num) : String(value);
  }

  if (kind === "date") {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return String(value);
    try {
      if (dateFormat === "YYYY-MM-DD") {
        return d.toISOString().slice(0, 10);
      }
      return d.toLocaleDateString();
    } catch {
      return d.toLocaleDateString();
    }
  }

  return String(value);
}

export const PAGE_SIZES = {
  A4: { w: 794, h: 1123 },
  Letter: { w: 816, h: 1056 },
} as const;

export type PageSize = keyof typeof PAGE_SIZES;
