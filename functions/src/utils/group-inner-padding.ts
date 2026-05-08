import type { TemplateElement } from "../core/entities/template";

export const DEFAULT_GROUP_INNER_PADDING = {
  top: 12,
  right: 12,
  bottom: 12,
  left: 12,
} as const;

export function resolveGroupInnerPadding(
  group: Extract<TemplateElement, { type: "group" }>
): { top: number; right: number; bottom: number; left: number } {
  return group.innerPadding ?? { ...DEFAULT_GROUP_INNER_PADDING };
}
