import * as XLSX from "xlsx";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import type { ExportFormat } from "../core/entities/export-import";

export interface RowData {
  [key: string]: string | number | boolean | null | undefined;
}

export interface SheetData {
  name: string;
  data: RowData[];
  headers?: string[]; // Optional: specify column order
}

export interface FileGeneratorService {
  /**
   * Generate a file from sheet data and upload to Firebase Storage
   * Returns the public URL of the uploaded file
   */
  generateAndUpload(
    sheets: SheetData[],
    format: ExportFormat,
    storagePath: string,
  ): Promise<{ url: string; sizeBytes: number }>;

  /**
   * Generate a file buffer from sheet data
   */
  generateBuffer(sheets: SheetData[], format: ExportFormat): Buffer;
}

/**
 * Generate CSV buffer
 */
function generateCSV(sheets: SheetData[]): Buffer {
  if (sheets.length === 0) {
    throw new Error("At least one sheet is required");
  }

  // CSV only supports one sheet, use the first one
  const sheet = sheets[0];
  const data = sheet.data;

  if (data.length === 0) {
    return Buffer.from("", "utf-8");
  }

  // Get headers from first row or use provided headers
  const headers = sheet.headers || Object.keys(data[0] || {});

  // Build CSV content
  const lines: string[] = [];

  // Header row
  lines.push(headers.map((h) => escapeCSVValue(String(h))).join(","));

  // Data rows
  data.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) {
        return "";
      }
      return escapeCSVValue(String(value));
    });
    lines.push(values.join(","));
  });

  return Buffer.from(lines.join("\n"), "utf-8");
}

/**
 * Escape CSV value (handle quotes and commas)
 */
function escapeCSVValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate XLS/XLSX buffer
 */
function generateExcel(sheets: SheetData[], format: "xls" | "xlsx"): Buffer {
  if (sheets.length === 0) {
    throw new Error("At least one sheet is required");
  }

  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const { name, data, headers } = sheet;

    if (data.length === 0) {
      // Empty sheet with headers only
      if (headers && headers.length > 0) {
        const worksheet = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(workbook, worksheet, name);
      } else {
        const worksheet = XLSX.utils.aoa_to_sheet([[]]);
        XLSX.utils.book_append_sheet(workbook, worksheet, name);
      }
      return;
    }

    // Determine column order
    const columnOrder = headers || Object.keys(data[0] || {});

    // Convert data to array of arrays
    const rows: unknown[][] = [];

    // Header row
    rows.push(columnOrder);

    // Data rows
    data.forEach((row) => {
      const values = columnOrder.map((header) => {
        const value = row[header];
        // Preserve types: numbers, booleans, dates
        if (value === null || value === undefined) {
          return "";
        }
        return value;
      });
      rows.push(values);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths (optional, but improves readability)
    const colWidths = columnOrder.map((header) => {
      // Estimate width based on header and max content length
      const headerLength = String(header).length;
      const maxContentLength = Math.max(
        ...data.map((row) => {
          const val = row[header];
          return val ? String(val).length : 0;
        }),
      );
      return Math.max(headerLength, maxContentLength, 10);
    });
    worksheet["!cols"] = colWidths.map((w) => ({ wch: Math.min(w, 50) }));

    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  });

  // Generate buffer
  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: format,
    cellDates: true,
    cellStyles: false,
  });

  return buffer;
}

/**
 * Upload buffer to Firebase Storage
 */
async function uploadToStorage(
  buffer: Buffer,
  storagePath: string,
  contentType: string,
): Promise<{ url: string; sizeBytes: number }> {
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    },
  });

  // Make file publicly readable
  await file.makePublic();

  // Get public URL
  const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  return { url, sizeBytes: buffer.length };
}

/**
 * Get content type for format
 */
function getContentType(format: ExportFormat): string {
  switch (format) {
    case "csv":
      return "text/csv";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
}

export const fileGeneratorService: FileGeneratorService = {
  async generateAndUpload(
    sheets: SheetData[],
    format: ExportFormat,
    storagePath: string,
  ): Promise<{ url: string; sizeBytes: number }> {
    try {
      logger.info("Generating file", { format, storagePath, sheetCount: sheets.length });

      const buffer = this.generateBuffer(sheets, format);
      const contentType = getContentType(format);

      const result = await uploadToStorage(buffer, storagePath, contentType);

      logger.info("File generated and uploaded", {
        format,
        storagePath,
        url: result.url,
        sizeBytes: result.sizeBytes,
      });

      return result;
    } catch (error) {
      logger.error("Failed to generate and upload file", {
        format,
        storagePath,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error(
        `Failed to generate file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  },

  generateBuffer(sheets: SheetData[], format: ExportFormat): Buffer {
    switch (format) {
      case "csv":
        return generateCSV(sheets);
      case "xls":
      case "xlsx":
        return generateExcel(sheets, format);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  },
};
