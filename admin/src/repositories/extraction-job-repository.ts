import { DatabaseService } from "@/core";
import { DatabaseCollection } from "./config";
import { getGenericRepository } from "./generic-repository";

// Import types from backend (we'll need to create frontend types or import from shared)
// For now, using a basic structure
export interface ExtractionJob {
  id: string;
  orgId: string;
  fileUrl: string;
  fileName: string;
  fileType: "pdf" | "image/jpeg" | "image/png" | "image/jpg" | "image/webp";
  fileSizeBytes: number;
  status: "pending" | "processing" | "extracted" | "validated" | "completed" | "failed" | "cancelled";
  extractedData?: Record<string, unknown>;
  confidenceScores?: Record<string, number>;
  matchedTemplateId?: string;
  matchConfidence?: number;
  fieldMappings?: Array<{
    extractedField: string;
    templateBinding: string;
    confidence: number;
    userVerified: boolean;
  }>;
  correctedData?: Record<string, unknown>;
  createdInvoiceId?: string;
  createdTemplateId?: string;
  errorMessage?: string;
  processingDurationMs?: number;
  vendorName?: string;
  documentType?: "invoice" | "receipt" | "utility_bill" | "unknown";
  createdAt?: string;
  updatedAt?: string;
}

export interface ExtractionJobData {
  orgId: string;
  fileUrl: string;
  fileName: string;
  fileType: "pdf" | "image/jpeg" | "image/png" | "image/jpg" | "image/webp";
  fileSizeBytes: number;
  status: "pending" | "processing" | "extracted" | "validated" | "completed" | "failed" | "cancelled";
  extractedData?: Record<string, unknown>;
  confidenceScores?: Record<string, number>;
  matchedTemplateId?: string;
  matchConfidence?: number;
  fieldMappings?: Array<{
    extractedField: string;
    templateBinding: string;
    confidence: number;
    userVerified: boolean;
  }>;
  correctedData?: Record<string, unknown>;
  createdInvoiceId?: string;
  createdTemplateId?: string;
  errorMessage?: string;
  processingDurationMs?: number;
  vendorName?: string;
  documentType?: "invoice" | "receipt" | "utility_bill" | "unknown";
}

export interface ExtractionJobRepository {
  get: (payload: { id: string }) => Promise<ExtractionJob | null>;
  getAll: (payload?: {
    queryConstraints?: Array<{ field: string; operator: "==" | ">" | "<" | ">=" | "<="; value: unknown }>;
    orderBy?: { field: string; direction: "asc" | "desc" };
    pagination?: { limit?: number; offset?: number };
  }) => Promise<ExtractionJob[]>;
  create: (payload: { data: ExtractionJobData }) => Promise<string>;
  update: (payload: { id: string; data: Partial<ExtractionJobData> }) => Promise<void>;
  delete: (payload: { id: string }) => Promise<void>;
}

export function getExtractionJobRepository(
  databaseService: DatabaseService,
): ExtractionJobRepository {
  return getGenericRepository<ExtractionJob, ExtractionJobData>(
    () => DatabaseCollection.EXTRACTION_JOBS,
    databaseService,
  );
}

