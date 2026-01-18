import * as XLSX from "xlsx";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import type { ExportFormat } from "../core/entities/export-import";

export interface ParsedRow {
  [key: string]: string | number | boolean | null | undefined;
}

export type RowData = ParsedRow;

export interface ParsedFile {
  sheets: Record<string, ParsedRow[]>;
  sheetNames: string[];
}

export interface FileParserService {
  /**
   * Parse a file from Firebase Storage URL
   * Returns parsed data with sheets (for XLSX) or single sheet (for CSV/XLS)
   */
  parseFile(fileUrl: string, format: ExportFormat): Promise<ParsedFile>;

  /**
   * Parse a file buffer directly
   */
  parseBuffer(buffer: Buffer, format: ExportFormat, fileName?: string): ParsedFile;
}

/**
 * Extract storage path from Firebase Storage URL
 */
function extractStoragePath(fileUrl: string): string {
  // Handle gs:// format
  if (fileUrl.startsWith("gs://")) {
    const match = fileUrl.match(/^gs:\/\/([^\/]+)\/(.+)$/);
    if (match) {
      return match[2];
    }
  }

  // Handle storage.googleapis.com format
  if (fileUrl.includes("storage.googleapis.com")) {
    const match = fileUrl.match(/storage\.googleapis\.com\/([^\/]+)\/(.+)$/);
    if (match) {
      return match[2].split("?")[0];
    }
  }

  // Handle firebasestorage.googleapis.com format
  if (fileUrl.includes("firebasestorage.googleapis.com")) {
    const match = fileUrl.match(/\/o\/(.+)$/);
    if (match) {
      return decodeURIComponent(match[1].split("?")[0]);
    }
  }

  // Fallback: assume it's already a path
  return fileUrl;
}

/**
 * Download file from Firebase Storage
 */
async function downloadFile(fileUrl: string): Promise<Buffer> {
  const bucket = getStorage().bucket();
  const storagePath = extractStoragePath(fileUrl);
  const file = bucket.file(storagePath);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`File not found: ${fileUrl}`);
  }

  const [buffer] = await file.download();
  return buffer;
}

/**
 * Parse CSV buffer
 */
function parseCSV(buffer: Buffer): ParsedFile {
  const text = buffer.toString("utf-8");
  const workbook = XLSX.read(text, { type: "string" });

  const sheets: Record<string, ParsedRow[]> = {};
  const sheetNames: string[] = [];

  workbook.SheetNames.forEach((sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Get values as strings to preserve formatting
      defval: null, // Default value for empty cells
    }) as ParsedRow[];

    sheets[sheetName] = jsonData;
    sheetNames.push(sheetName);
  });

  return { sheets, sheetNames };
}

/**
 * Parse XLS/XLSX buffer
 */
function parseExcel(buffer: Buffer, format: "xls" | "xlsx"): ParsedFile {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true, // Parse dates
    cellNF: false, // Don't parse number formats
    cellText: false, // Get raw values
  });

  const sheets: Record<string, ParsedRow[]> = {};
  const sheetNames: string[] = [];

  workbook.SheetNames.forEach((sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON, preserving types
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: true, // Get raw values (numbers, dates, etc.)
      defval: null, // Default value for empty cells
      dateNF: "yyyy-mm-dd", // Date format
    }) as ParsedRow[];

    sheets[sheetName] = jsonData;
    sheetNames.push(sheetName);
  });

  return { sheets, sheetNames };
}

/**
 * Normalize column names (trim, handle special characters)
 */
function normalizeColumnName(name: string): string {
  return name.trim().replace(/\s+/g, "_").toLowerCase();
}

/**
 * Normalize parsed rows to have consistent column names
 */
function normalizeRows(rows: ParsedRow[]): ParsedRow[] {
  if (rows.length === 0) {
    return rows;
  }

  // Get all unique column names from all rows
  const allColumns = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      allColumns.add(key);
    });
  });

  // Normalize column names
  const columnMapping: Record<string, string> = {};
  allColumns.forEach((col) => {
    const normalized = normalizeColumnName(col);
    columnMapping[col] = normalized;
  });

  // Create normalized rows
  return rows.map((row) => {
    const normalized: ParsedRow = {};
    Object.keys(row).forEach((key) => {
      const normalizedKey = columnMapping[key];
      normalized[normalizedKey] = row[key];
    });
    return normalized;
  });
}

export const fileParserService: FileParserService = {
  async parseFile(fileUrl: string, format: ExportFormat): Promise<ParsedFile> {
    try {
      logger.info("Parsing file", { fileUrl, format });

      const buffer = await downloadFile(fileUrl);
      return this.parseBuffer(buffer, format);
    } catch (error) {
      logger.error("Failed to parse file", {
        fileUrl,
        format,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },

  parseBuffer(buffer: Buffer, format: ExportFormat, fileName?: string): ParsedFile {
    let parsed: ParsedFile;

    switch (format) {
      case "csv":
        parsed = parseCSV(buffer);
        break;
      case "xls":
      case "xlsx":
        parsed = parseExcel(buffer, format);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Normalize all sheets
    const normalizedSheets: Record<string, ParsedRow[]> = {};
    Object.keys(parsed.sheets).forEach((sheetName) => {
      normalizedSheets[sheetName] = normalizeRows(parsed.sheets[sheetName]);
    });

    return {
      sheets: normalizedSheets,
      sheetNames: parsed.sheetNames,
    };
  },
};
