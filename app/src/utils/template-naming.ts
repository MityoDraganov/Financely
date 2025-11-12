import { Template } from "@/core";

/**
 * Generates a unique template name by appending (1), (2), etc. if the name already exists
 * @param baseName The desired base name for the template
 * @param existingTemplates Array of existing templates for the organization
 * @returns A unique template name
 */
export function generateUniqueTemplateName(
  baseName: string,
  existingTemplates: Template[]
): string {
  // Get all existing template names (case-insensitive)
  const existingNames = new Set(
    existingTemplates.map((t) => t.name?.toLowerCase().trim() || "")
  );

  // Check if base name is already unique
  if (!existingNames.has(baseName.toLowerCase().trim())) {
    return baseName;
  }

  // Find the next available number
  let counter = 1;
  let candidateName: string;

  do {
    candidateName = `${baseName} (${counter})`;
    counter++;
  } while (existingNames.has(candidateName.toLowerCase().trim()));

  return candidateName;
}

