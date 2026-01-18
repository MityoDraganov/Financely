import { z } from "zod";
import { logger } from "firebase-functions";
import type {
  ImportError,
  ImportErrorCode,
  ExportEntityType,
} from "../core/entities/export-import";
import { productDataSchema } from "../core/entities/product";
import { contactDataSchema } from "../core/entities/contact";
import { leadDataSchema } from "../core/entities/lead";
import { proposalDataSchema } from "../core/entities/proposal";
import { invoiceDataSchema } from "../core/entities/invoice";
import { templateDataSchema } from "../core/entities/template";
import type { RowData } from "./file-parser-service";

export interface ValidationResult {
  valid: boolean;
  errors: ImportError[];
  data?: Record<string, unknown>;
}

export interface ImportValidationService {
  /**
   * Validate a row of data for a specific entity type
   */
  validateRow(
    row: RowData,
    entityType: ExportEntityType,
    orgId: string,
    rowIndex: number,
    columnMapping?: Record<string, string>,
  ): ValidationResult;

  /**
   * Validate multiple rows and return results
   */
  validateRows(
    rows: RowData[],
    entityType: ExportEntityType,
    orgId: string,
    columnMapping?: Record<string, string>,
  ): {
    validRows: Array<{ data: Record<string, unknown>; originalIndex: number }>;
    errors: ImportError[];
  };
}

/**
 * Map column names to entity field names
 */
function mapColumns(
  row: RowData,
  columnMapping?: Record<string, string>,
): Record<string, unknown> {
  if (!columnMapping) {
    return row as Record<string, unknown>;
  }

  const mapped: Record<string, unknown> = {};
  Object.keys(row).forEach((columnName) => {
    const fieldName = columnMapping[columnName] || columnName;
    mapped[fieldName] = row[columnName];
  });

  return mapped;
}

/**
 * Parse JSON string safely
 */
function parseJSON(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Coerce value to number
 */
// Helper function for future use - currently unused but may be needed for type coercion
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-ignore - Intentionally unused, reserved for future implementation
function _coerceNumber(_value: unknown): number | null {
  return null;
}

/**
 * Coerce value to boolean
 */
function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if (lower === "true" || lower === "1" || lower === "yes") {
      return true;
    }
    if (lower === "false" || lower === "0" || lower === "no") {
      return false;
    }
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return null;
}

/**
 * Parse date string - helper function for future use
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-ignore - Intentionally unused, reserved for future implementation
function _parseDate(_value: unknown): string | null {
  // Future implementation for date parsing
  return null;
}

/**
 * Transform flattened export data back to nested structure
 */
function unflattenData(
  flatData: Record<string, unknown>,
  entityType: ExportEntityType,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  Object.keys(flatData).forEach((key) => {
    const value = flatData[key];

    // Handle nested keys (e.g., "address_street" -> address.street)
    if (key.includes("_")) {
      const parts = key.split("_");
      const rootKey = parts[0];
      const restKey = parts.slice(1).join("_");

      if (!result[rootKey]) {
        result[rootKey] = {};
      }

      if (typeof result[rootKey] === "object" && result[rootKey] !== null) {
        (result[rootKey] as Record<string, unknown>)[restKey] = value;
      }
    } else {
      result[key] = value;
    }
  });

  // Entity-specific transformations
  switch (entityType) {
    case "products": {
      // Handle dimensions
      if (result.dimensions_length || result.dimensions_width || result.dimensions_height) {
        result.dimensions = {
          length: result.dimensions_length,
          width: result.dimensions_width,
          height: result.dimensions_height,
          unit: result.dimensions_unit || "cm",
        };
        delete result.dimensions_length;
        delete result.dimensions_width;
        delete result.dimensions_height;
        delete result.dimensions_unit;
      }

      // Parse arrays
      if (typeof result.images === "string") {
        result.images = parseJSON(result.images) as string[];
      }
      if (typeof result.tags === "string") {
        result.tags = parseJSON(result.tags) as string[];
      }
      break;
    }

    case "contacts": {
      // Handle address
      if (
        result.address_street ||
        result.address_city ||
        result.address_state ||
        result.address_zipCode ||
        result.address_country
      ) {
        result.address = {
          street: result.address_street,
          city: result.address_city,
          state: result.address_state,
          zipCode: result.address_zipCode,
          country: result.address_country,
        };
        delete result.address_street;
        delete result.address_city;
        delete result.address_state;
        delete result.address_zipCode;
        delete result.address_country;
      }

      // Handle preferences
      if (
        result.preferences_preferredContactMethod ||
        result.preferences_marketingOptIn !== undefined ||
        result.preferences_newsletterOptIn !== undefined
      ) {
        result.preferences = {
          preferredContactMethod: result.preferences_preferredContactMethod || "email",
          marketingOptIn: coerceBoolean(result.preferences_marketingOptIn) || false,
          newsletterOptIn: coerceBoolean(result.preferences_newsletterOptIn) || false,
        };
        delete result.preferences_preferredContactMethod;
        delete result.preferences_marketingOptIn;
        delete result.preferences_newsletterOptIn;
      }

      // Handle social media
      if (
        result.socialMedia_linkedin ||
        result.socialMedia_twitter ||
        result.socialMedia_facebook ||
        result.socialMedia_instagram
      ) {
        result.socialMedia = {
          linkedin: result.socialMedia_linkedin,
          twitter: result.socialMedia_twitter,
          facebook: result.socialMedia_facebook,
          instagram: result.socialMedia_instagram,
        };
        delete result.socialMedia_linkedin;
        delete result.socialMedia_twitter;
        delete result.socialMedia_facebook;
        delete result.socialMedia_instagram;
      }

      // Parse arrays
      if (typeof result.tags === "string") {
        result.tags = parseJSON(result.tags) as string[];
      }

      // Handle phone (can be string or array)
      if (result.phone && typeof result.phone === "string") {
        const phones = result.phone.split(",").map((p) => p.trim()).filter((p) => p);
        result.phone = phones.length === 1 ? phones[0] : phones;
      }
      break;
    }

    case "leads": {
      // Parse JSON fields
      if (typeof result.formData === "string") {
        result.formData = parseJSON(result.formData);
      }
      if (typeof result.tags === "string") {
        result.tags = parseJSON(result.tags) as string[];
      }
      break;
    }

    case "proposals": {
      // Parse JSON fields
      if (typeof result.items === "string") {
        result.items = parseJSON(result.items);
      }
      if (typeof result.incompleteItems === "string") {
        result.incompleteItems = parseJSON(result.incompleteItems);
      }

      // Handle approval
      if (
        result.approval_tokenHash ||
        result.approval_expiresAt ||
        result.approval_sentAt ||
        result.approval_approvedAt ||
        result.approval_rejectedAt
      ) {
        result.approval = {
          tokenHash: result.approval_tokenHash,
          expiresAt: result.approval_expiresAt,
          sentAt: result.approval_sentAt,
          approvedAt: result.approval_approvedAt,
          rejectedAt: result.approval_rejectedAt,
        };
        delete result.approval_tokenHash;
        delete result.approval_expiresAt;
        delete result.approval_sentAt;
        delete result.approval_approvedAt;
        delete result.approval_rejectedAt;
      }
      break;
    }

    case "invoices": {
      // Parse JSON data field
      if (typeof result.data === "string") {
        result.data = parseJSON(result.data);
      }
      break;
    }

    case "templates": {
      // Parse JSON fields
      if (typeof result.elements === "string") {
        result.elements = parseJSON(result.elements);
      }
      if (typeof result.brand === "string") {
        result.brand = parseJSON(result.brand);
      }
      if (typeof result.compliance === "string") {
        result.compliance = parseJSON(result.compliance);
      }
      if (typeof result.productTableConfig === "string") {
        result.productTableConfig = parseJSON(result.productTableConfig);
      }
      break;
    }
  }

  return result;
}

/**
 * Validate against schema and return errors
 */
function validateWithSchema(
  data: Record<string, unknown>,
  schema: z.ZodSchema,
  rowIndex: number,
): ValidationResult {
  const errors: ImportError[] = [];

  try {
    const result = schema.safeParse(data);

    if (!result.success) {
      result.error.issues.forEach((error) => {
        const field = error.path.join(".");
        errors.push({
          rowIndex,
          errorCode: getErrorCode(error.code),
          errorMessage: error.message,
          field,
          value: (error.path as Array<string | number>).reduce((obj: unknown, key: string | number) => {
            if (typeof obj === "object" && obj !== null) {
              return (obj as Record<string, unknown>)[String(key)];
            }
            return undefined;
          }, data),
        });
      });

      return { valid: false, errors };
    }

    return { valid: true, errors: [], data: result.data as Record<string, unknown> };
  } catch (error) {
    logger.error("Validation error", {
      error: error instanceof Error ? error.message : "Unknown error",
      rowIndex,
    });

    errors.push({
      rowIndex,
      errorCode: "INVALID_FORMAT",
      errorMessage: error instanceof Error ? error.message : "Validation failed",
    });

    return { valid: false, errors };
  }
}

/**
 * Map Zod error code to ImportErrorCode
 */
function getErrorCode(zodCode: string): ImportErrorCode {
  switch (zodCode) {
    case "invalid_type":
      return "INVALID_TYPE";
    case "invalid_string":
      if (zodCode.includes("email")) {
        return "INVALID_EMAIL";
      }
      return "INVALID_FORMAT";
    case "invalid_date":
      return "INVALID_DATE";
    case "too_small":
    case "too_big":
      return "VALUE_OUT_OF_RANGE";
    case "invalid_enum_value":
      return "ENUM_NOT_ALLOWED";
    default:
      return "INVALID_FORMAT";
  }
}

/**
 * Get schema for entity type
 */
function getEntitySchema(
  entityType: ExportEntityType,
  orgId: string,
): z.ZodSchema {
  switch (entityType) {
    case "products":
      return productDataSchema.extend({
        organizationId: z.literal(orgId),
      });
    case "contacts":
      return contactDataSchema.extend({
        organizationId: z.literal(orgId),
      });
    case "leads":
      return leadDataSchema.extend({
        organizationId: z.literal(orgId),
      });
    case "proposals":
      return proposalDataSchema.extend({
        organizationId: z.literal(orgId),
      });
    case "invoices":
      return invoiceDataSchema.extend({
        orgId: z.literal(orgId),
      });
    case "templates":
      return templateDataSchema.extend({
        orgId: z.literal(orgId),
      });
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

export const importValidationService: ImportValidationService = {
  validateRow(
    row: RowData,
    entityType: ExportEntityType,
    orgId: string,
    rowIndex: number,
    columnMapping?: Record<string, string>,
  ): ValidationResult {
    try {
      // Map columns
      const mapped = mapColumns(row, columnMapping);

      // Remove export-specific fields
      delete mapped.schema_version;
      delete mapped.external_id;
      delete mapped.created_at;
      delete mapped.updated_at;

      // Unflatten nested structures
      const unflattened = unflattenData(mapped, entityType);

      // Add orgId
      if (entityType === "invoices" || entityType === "templates") {
        unflattened.orgId = orgId;
      } else {
        unflattened.organizationId = orgId;
      }

      // Get schema
      const schema = getEntitySchema(entityType, orgId);

      // Validate
      return validateWithSchema(unflattened, schema, rowIndex);
    } catch (error) {
      logger.error("Row validation error", {
        error: error instanceof Error ? error.message : "Unknown error",
        rowIndex,
        entityType,
      });

      return {
        valid: false,
        errors: [
          {
            rowIndex,
            errorCode: "INVALID_FORMAT",
            errorMessage: error instanceof Error ? error.message : "Validation failed",
          },
        ],
      };
    }
  },

  validateRows(
    rows: RowData[],
    entityType: ExportEntityType,
    orgId: string,
    columnMapping?: Record<string, string>,
  ): {
    validRows: Array<{ data: Record<string, unknown>; originalIndex: number }>;
    errors: ImportError[];
  } {
    const validRows: Array<{ data: Record<string, unknown>; originalIndex: number }> = [];
    const allErrors: ImportError[] = [];

    rows.forEach((row, index) => {
      const result = this.validateRow(row, entityType, orgId, index, columnMapping);

      if (result.valid && result.data) {
        validRows.push({
          data: result.data,
          originalIndex: index,
        });
      } else {
        allErrors.push(...result.errors);
      }
    });

    return { validRows, errors: allErrors };
  },
};
