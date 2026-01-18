import { logger } from "firebase-functions";
import { firestore } from "firebase-admin";
import type {
  ImportDataInput,
  ExportEntityType,
  ImportError,
} from "../core/entities/export-import";
import type { DatabaseService } from "../core";
import { fileParserService, type ParsedFile } from "./file-parser-service";
import { importValidationService } from "./import-validation-service";
import { fileGeneratorService } from "./file-generator-service";
import { DatabaseCollection } from "../repositories/config";

export interface ImportService {
  /**
   * Import entities from file
   */
  importEntities(
    input: ImportDataInput,
    databaseService: DatabaseService,
    userId: string,
  ): Promise<{
    stats: {
      totalRows: number;
      validRows: number;
      importedRows: number;
      skippedRows: number;
      errorRows: number;
    };
    errorReportUrl?: string;
  }>;
}

/**
 * Get collection name for entity type
 */
function getCollectionName(entityType: ExportEntityType): string {
  switch (entityType) {
    case "products":
      return DatabaseCollection.PRODUCTS;
    case "contacts":
      return DatabaseCollection.CONTACTS;
    case "leads":
      return DatabaseCollection.LEADS;
    case "proposals":
      return DatabaseCollection.PROPOSALS;
    case "invoices":
      return DatabaseCollection.INVOICES;
    case "templates":
      return DatabaseCollection.TEMPLATES;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Detect format from file name
 */
function detectFormat(fileName: string): "csv" | "xls" | "xlsx" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    return "csv";
  }
  if (lower.endsWith(".xls")) {
    return "xls";
  }
  if (lower.endsWith(".xlsx")) {
    return "xlsx";
  }
  throw new Error(`Unable to detect format from filename: ${fileName}`);
}

/**
 * Find existing entity by external_id
 */
async function findEntityByExternalId(
  databaseService: DatabaseService,
  collectionName: string,
  orgId: string,
  externalId: string,
  entityType: ExportEntityType,
): Promise<string | null> {
  // Query for documents with matching external_id in data
  // Note: This requires storing external_id in the document data
  // For now, we'll query all documents and check (inefficient but works)
  // In production, you'd want to add external_id as a field and index it

  const collection = firestore().collection(collectionName);
  const orgField = entityType === "invoices" || entityType === "templates" ? "data.orgId" : "data.organizationId";
  
  const snapshot = await collection
    .where(orgField, "==", orgId)
    .limit(1000) // Limit to prevent timeout
    .get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Check if external_id matches (would be stored in a metadata field)
    // For now, we'll use a different approach: hash the doc ID and compare
    // This is a simplified approach - in production, store external_id explicitly
    const docExternalId = data.metadata?.externalId;
    if (docExternalId === externalId) {
      return doc.id;
    }
  }

  return null;
}

/**
 * Import entities (create-only mode)
 */
async function importCreateOnly(
  databaseService: DatabaseService,
  collectionName: string,
  validRows: Array<{ data: Record<string, unknown>; originalIndex: number }>,
  entityType: ExportEntityType,
  orgId: string,
): Promise<{ imported: number; skipped: number }> {
  const batchOperations: Array<(batch: firestore.WriteBatch) => void> = [];
  let imported = 0;
  let skipped = 0;

  for (const row of validRows) {
    try {
      const entityData = row.data;

      // Add timestamps
      const now = new Date().toISOString();
      entityData.createdAt = now;
      entityData.updatedAt = now;

      // Create document
      const docRef = firestore().collection(collectionName).doc();
      batchOperations.push((batch) => {
        batch.set(docRef, {
          id: docRef.id,
          data: entityData,
          createdAt: now,
          updatedAt: now,
        });
      });

      imported++;

      // Commit in batches of 500
      if (batchOperations.length >= 500) {
        await databaseService.executeBatchOperations(batchOperations);
        batchOperations.length = 0;
      }
    } catch (error) {
      logger.error("Failed to prepare entity for import", {
        error: error instanceof Error ? error.message : "Unknown error",
        originalIndex: row.originalIndex,
        entityType,
      });
      skipped++;
    }
  }

  // Commit remaining operations
  if (batchOperations.length > 0) {
    await databaseService.executeBatchOperations(batchOperations);
  }

  return { imported, skipped };
}

/**
 * Import entities (upsert mode)
 */
async function importUpsert(
  databaseService: DatabaseService,
  collectionName: string,
  validRows: Array<{ data: Record<string, unknown>; originalIndex: number }>,
  entityType: ExportEntityType,
  orgId: string,
  parsedFile: ParsedFile,
): Promise<{ imported: number; skipped: number }> {
  const batchOperations: Array<(batch: firestore.WriteBatch) => void> = [];
  let imported = 0;
  let skipped = 0;

  // Build external_id to row mapping
  const externalIdMap = new Map<string, { data: Record<string, unknown>; originalIndex: number }>();
  
  // Get external_id from first sheet
  const firstSheetName = parsedFile.sheetNames[0];
  const firstSheet = parsedFile.sheets[firstSheetName];
  
  firstSheet.forEach((row, index) => {
    const externalId = row.external_id as string;
    if (externalId) {
      const validRow = validRows.find((vr) => vr.originalIndex === index);
      if (validRow) {
        externalIdMap.set(externalId, validRow);
      }
    }
  });

  // For each row, check if entity exists
  for (const [externalId, row] of externalIdMap.entries()) {
    try {
      const existingId = await findEntityByExternalId(
        databaseService,
        collectionName,
        orgId,
        externalId,
        entityType,
      );

      const now = new Date().toISOString();
      const entityData = { ...row.data };
      entityData.updatedAt = now;

      if (existingId) {
        // Update existing
        const docRef = firestore().collection(collectionName).doc(existingId);
        batchOperations.push((batch) => {
          batch.update(docRef, {
            data: entityData,
            updatedAt: now,
          });
        });
      } else {
        // Create new
        entityData.createdAt = now;
        const docRef = firestore().collection(collectionName).doc();
        batchOperations.push((batch) => {
          batch.set(docRef, {
            id: docRef.id,
            data: entityData,
            createdAt: now,
            updatedAt: now,
            metadata: {
              externalId,
            },
          });
        });
      }

      imported++;

      // Commit in batches of 500
      if (batchOperations.length >= 500) {
        await databaseService.executeBatchOperations(batchOperations);
        batchOperations.length = 0;
      }
    } catch (error) {
      logger.error("Failed to prepare entity for upsert", {
        error: error instanceof Error ? error.message : "Unknown error",
        originalIndex: row.originalIndex,
        entityType,
        externalId,
      });
      skipped++;
    }
  }

  // Commit remaining operations
  if (batchOperations.length > 0) {
    await databaseService.executeBatchOperations(batchOperations);
  }

  return { imported, skipped };
}

/**
 * Generate error report
 */
async function generateErrorReport(
  errors: ImportError[],
  orgId: string,
  jobId: string,
  entityType: string,
): Promise<string> {
  const errorSheet: Array<Record<string, unknown>> = errors.map((error) => ({
    row_index: error.rowIndex + 1, // 1-based for user readability
    error_code: error.errorCode,
    error_message: error.errorMessage,
    field: error.field || "",
    value: error.value ? String(error.value) : "",
  }));

  const sheets = [
    {
      name: "Errors",
      data: errorSheet as Array<Record<string, string | number | boolean | null | undefined>>,
      headers: ["row_index", "error_code", "error_message", "field", "value"],
    },
  ];

  const storagePath = `organizations/${orgId}/import-jobs/${jobId}/error-report.xlsx`;
  const result = await fileGeneratorService.generateAndUpload(sheets, "xlsx", storagePath);

  return result.url;
}

export const importService: ImportService = {
  async importEntities(
    input: ImportDataInput,
    databaseService: DatabaseService,
    userId: string,
  ): Promise<{
    stats: {
      totalRows: number;
      validRows: number;
      importedRows: number;
      skippedRows: number;
      errorRows: number;
    };
    errorReportUrl?: string;
  }> {
    const { orgId, fileUrl, fileName, entityType, mode, columnMapping } = input;

    logger.info("Starting import", { orgId, entityType, mode, fileName, userId });

    // Detect format
    const format = detectFormat(fileName);

    // Parse file
    const parsedFile = await fileParserService.parseFile(fileUrl, format);

    // Get first sheet (CSV has one sheet, XLSX might have multiple)
    const firstSheetName = parsedFile.sheetNames[0];
    const rows = parsedFile.sheets[firstSheetName] || [];

    logger.info("File parsed", {
      sheetCount: parsedFile.sheetNames.length,
      rowCount: rows.length,
      firstSheetName,
    });

    // Validate rows
    const { validRows, errors } = importValidationService.validateRows(
      rows,
      entityType,
      orgId,
      columnMapping,
    );

    logger.info("Validation completed", {
      totalRows: rows.length,
      validRows: validRows.length,
      errorRows: errors.length,
    });

    // Import valid rows
    const collectionName = getCollectionName(entityType);
    let importResult: { imported: number; skipped: number };

    if (mode === "create-only") {
      importResult = await importCreateOnly(
        databaseService,
        collectionName,
        validRows,
        entityType,
        orgId,
      );
    } else {
      importResult = await importUpsert(
        databaseService,
        collectionName,
        validRows,
        entityType,
        orgId,
        parsedFile,
      );
    }

    // Generate error report if there are errors
    let errorReportUrl: string | undefined;
    if (errors.length > 0) {
      // Generate a temporary job ID for error report storage
      const jobId = `error-${Date.now()}`;
      errorReportUrl = await generateErrorReport(errors, orgId, jobId, entityType);
    }

    const stats = {
      totalRows: rows.length,
      validRows: validRows.length,
      importedRows: importResult.imported,
      skippedRows: importResult.skipped,
      errorRows: errors.length,
    };

    logger.info("Import completed", {
      orgId,
      entityType,
      stats,
      errorReportUrl,
    });

    return {
      stats,
      errorReportUrl,
    };
  },
};
