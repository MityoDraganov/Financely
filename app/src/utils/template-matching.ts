import type { Template } from "@/core";
import type { ExtractionJob } from "@/repositories/extraction-job-repository";

/**
 * Simple template matching based on vendor name and field structure
 * Returns templates that might match the extracted invoice data
 */
export function findMatchingTemplates(
  extractionJob: ExtractionJob,
  templates: Template[]
): Array<{ template: Template; confidence: number; reason: string }> {
  if (!extractionJob.extractedData || !extractionJob.vendorName) {
    return [];
  }

  const extractedData = extractionJob.extractedData;
  const vendorName = extractionJob.vendorName.toLowerCase();
  const extractedFields = Object.keys(extractedData);

  const matches: Array<{ template: Template; confidence: number; reason: string }> = [];

  for (const template of templates) {
    let confidence = 0;
    const reasons: string[] = [];

    // Extract template bindings
    const templateBindings = extractTemplateBindings(template);

    // Check vendor name match (if template has vendor info in name/description)
    const templateText = `${template.name || ""} ${template.description || ""}`.toLowerCase();
    if (templateText.includes(vendorName) || vendorName.includes(template.name?.toLowerCase() || "")) {
      confidence += 0.5;
      reasons.push("Vendor name match");
    }

    // Check field structure match
    const matchingFields = extractedFields.filter(field => 
      templateBindings.has(field) || 
      templateBindings.has(field.split(".")[0]) // Check nested fields
    );
    
    const fieldMatchRatio = matchingFields.length / Math.max(extractedFields.length, 1);
    if (fieldMatchRatio > 0.5) {
      confidence += fieldMatchRatio * 0.5;
      reasons.push(`${matchingFields.length}/${extractedFields.length} fields match`);
    }

    if (confidence > 0.3) {
      matches.push({
        template,
        confidence: Math.min(confidence, 1),
        reason: reasons.join(", "),
      });
    }
  }

  // Sort by confidence descending
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Extract all bindings from a template
 */
function extractTemplateBindings(template: Template): Set<string> {
  const bindings = new Set<string>();
  
  if (!template.elements) return bindings;

  for (const element of template.elements) {
    if (element.type === "text" || element.type === "input" || element.type === "currency") {
      if (element.binding) {
        bindings.add(element.binding);
      }
    } else if (element.type === "table") {
      if (element.itemsBinding) {
        bindings.add(element.itemsBinding);
      }
      if (element.columns) {
        for (const column of element.columns) {
          if (column.binding) {
            bindings.add(`${element.itemsBinding}[*].${column.binding}`);
            bindings.add(column.binding);
          }
        }
      }
    }
  }

  return bindings;
}

