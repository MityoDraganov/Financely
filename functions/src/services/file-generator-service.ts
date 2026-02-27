import * as XLSX from "xlsx";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { crc32 } from "node:zlib";
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
 * Generate CSV text for a single sheet
 */
function generateCSVContent(sheet: SheetData): string {
  const data = sheet.data;

  if (data.length === 0) {
    return "";
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

  return lines.join("\n");
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
  return Buffer.from(generateCSVContent(sheet), "utf-8");
}

interface ZipEntry {
  fileName: string;
  content: Buffer;
}

/**
 * Build a .zip archive using "stored" (uncompressed) entries.
 * This avoids extra dependencies while keeping predictable output.
 */
function createZipBuffer(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileNameBuffer = Buffer.from(entry.fileName, "utf-8");
    const content = entry.content;
    const entryCrc32 = Number(crc32(content)) >>> 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4); // Version needed to extract
    localHeader.writeUInt16LE(0, 6); // General purpose bit flag
    localHeader.writeUInt16LE(0, 8); // Compression method (stored)
    localHeader.writeUInt16LE(0, 10); // Last mod file time
    localHeader.writeUInt16LE(0, 12); // Last mod file date
    localHeader.writeUInt32LE(entryCrc32, 14); // CRC-32
    localHeader.writeUInt32LE(content.length, 18); // Compressed size
    localHeader.writeUInt32LE(content.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(fileNameBuffer.length, 26); // File name length
    localHeader.writeUInt16LE(0, 28); // Extra field length

    localParts.push(localHeader, fileNameBuffer, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central file header signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed to extract
    centralHeader.writeUInt16LE(0, 8); // General purpose bit flag
    centralHeader.writeUInt16LE(0, 10); // Compression method
    centralHeader.writeUInt16LE(0, 12); // Last mod file time
    centralHeader.writeUInt16LE(0, 14); // Last mod file date
    centralHeader.writeUInt32LE(entryCrc32, 16); // CRC-32
    centralHeader.writeUInt32LE(content.length, 20); // Compressed size
    centralHeader.writeUInt32LE(content.length, 24); // Uncompressed size
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28); // File name length
    centralHeader.writeUInt16LE(0, 30); // Extra field length
    centralHeader.writeUInt16LE(0, 32); // File comment length
    centralHeader.writeUInt16LE(0, 34); // Disk number start
    centralHeader.writeUInt16LE(0, 36); // Internal file attributes
    centralHeader.writeUInt32LE(0, 38); // External file attributes
    centralHeader.writeUInt32LE(offset, 42); // Relative offset of local header

    centralParts.push(centralHeader, fileNameBuffer);

    offset += localHeader.length + fileNameBuffer.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0); // End of central dir signature
  endOfCentralDirectory.writeUInt16LE(0, 4); // Number of this disk
  endOfCentralDirectory.writeUInt16LE(0, 6); // Number of the disk with central directory
  endOfCentralDirectory.writeUInt16LE(entries.length, 8); // Total entries on this disk
  endOfCentralDirectory.writeUInt16LE(entries.length, 10); // Total entries
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12); // Central directory size
  endOfCentralDirectory.writeUInt32LE(offset, 16); // Offset of central directory
  endOfCentralDirectory.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function sanitizeCsvFileName(name: string, fallbackIndex: number): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `sheet-${fallbackIndex + 1}`;
}

/**
 * Generate ZIP archive containing one CSV per sheet.
 */
function generateCSVArchive(sheets: SheetData[]): Buffer {
  if (sheets.length === 0) {
    throw new Error("At least one sheet is required");
  }

  const usedNames = new Set<string>();
  const entries: ZipEntry[] = sheets.map((sheet, index) => {
    const baseName = sanitizeCsvFileName(sheet.name, index);
    let candidateName = `${baseName}.csv`;
    let suffix = 2;
    while (usedNames.has(candidateName)) {
      candidateName = `${baseName}-${suffix}.csv`;
      suffix++;
    }
    usedNames.add(candidateName);

    return {
      fileName: candidateName,
      content: Buffer.from(generateCSVContent(sheet), "utf-8"),
    };
  });

  return createZipBuffer(entries);
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
function getContentType(format: ExportFormat, sheetCount: number): string {
  switch (format) {
    case "csv":
      return sheetCount > 1 ? "application/zip" : "text/csv";
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
      const contentType = getContentType(format, sheets.length);

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
        return sheets.length > 1 ? generateCSVArchive(sheets) : generateCSV(sheets);
      case "xls":
      case "xlsx":
        return generateExcel(sheets, format);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  },
};
