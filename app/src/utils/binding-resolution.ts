import { FIELD_CATALOG, getCatalogField, type FieldDefinition } from "@/core/entities/field-catalog";

export type ResolutionResult =
  | { fieldId: string; resolved: "direct" | "alias" }
  | { fieldId: undefined; resolved: "unknown" };

/**
 * Resolve a binding string to its canonical field ID.
 * Resolution order:
 *   1. binding === field.id (direct)
 *   2. binding in field.aliases (alias)
 *   3. unknown
 */
export function resolveBinding(binding: string | undefined): ResolutionResult {
  if (!binding) return { fieldId: undefined, resolved: "unknown" };

  // 1. Direct ID match
  const direct = getCatalogField(binding);
  if (direct) return { fieldId: binding, resolved: "direct" };

  // 2. Alias match
  const byAlias = FIELD_CATALOG.find((f) => f.aliases?.includes(binding));
  if (byAlias) return { fieldId: byAlias.id, resolved: "alias" };

  return { fieldId: undefined, resolved: "unknown" };
}

/**
 * Returns element.fieldId if set, otherwise resolves from binding/itemsBinding.
 */
export function extractTemplateElementFieldId(el: {
  fieldId?: string;
  binding?: string;
  itemsBinding?: string;
}): string | undefined {
  if (el.fieldId) return el.fieldId;
  const bindingToCheck = el.itemsBinding ?? el.binding;
  const result = resolveBinding(bindingToCheck);
  return result.fieldId;
}

/**
 * Returns the full FieldDefinition for an element, or undefined.
 */
export function resolveElementField(el: {
  fieldId?: string;
  binding?: string;
  itemsBinding?: string;
}): FieldDefinition | undefined {
  const fieldId = extractTemplateElementFieldId(el);
  if (!fieldId) return undefined;
  return getCatalogField(fieldId);
}
