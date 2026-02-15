/**
 * Backward-compatible export surface for template block LLM/schema contracts.
 * Canonical definitions now live in ./llm/block-contract.ts.
 */

export {
  BLOCK_SCHEMA_VERSION,
  TEMPLATE_ELEMENT_TYPES,
  type TemplateElementType,
  type TemplateLlmTask,
  buildTemplateLlmManifest,
  buildTemplateSchemaGuidance,
  buildTemplateGenerationSchema,
} from "./llm/block-contract";
