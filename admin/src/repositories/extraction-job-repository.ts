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
  documentPages?: Array<{
    pageIndex: number;
    width: number;
    height: number;
    imageUrl: string;
    mimeType?: string;
    source: "original" | "rendered_pdf";
  }>;
  ocrWords?: Array<{
    id: string;
    text: string;
    confidence: number;
    pageIndex: number;
    boundingBox: { x: number; y: number; width: number; height: number };
    normalizedBoundingBox: { x: number; y: number; width: number; height: number };
    polygon: Array<{ x: number; y: number }>;
  }>;
  visionLayout?: {
    regions: Array<Record<string, unknown>>;
    elements: Array<Record<string, unknown>>;
    tables: Array<Record<string, unknown>>;
    styleClusters: Array<Record<string, unknown>>;
  };
  fusionMap?: Array<{
    binding: string;
    valueText?: string;
    ocrWordIds: string[];
    layoutNodeIds: string[];
    boundingBox?: { x: number; y: number; width: number; height: number };
    confidence: number;
    fieldType: "text" | "currency" | "date" | "number" | "table" | "unknown";
  }>;
  fontMatches?: Array<{
    clusterId: string;
    provider: "external_api" | "fallback";
    matchedFont: string;
    fallbackFont: string;
    confidence: number;
    raw?: Record<string, unknown>;
  }>;
  croppedAssets?: Array<{
    id: string;
    pageIndex: number;
    kind: "logo" | "image";
    imageUrl: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;
  quality?: { overall: number; layout: number; text: number; table: number; font: number };
  needsReview?: boolean;
  reviewReasons?: string[];
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
  documentPages?: Array<{
    pageIndex: number;
    width: number;
    height: number;
    imageUrl: string;
    mimeType?: string;
    source: "original" | "rendered_pdf";
  }>;
  ocrWords?: Array<{
    id: string;
    text: string;
    confidence: number;
    pageIndex: number;
    boundingBox: { x: number; y: number; width: number; height: number };
    normalizedBoundingBox: { x: number; y: number; width: number; height: number };
    polygon: Array<{ x: number; y: number }>;
  }>;
  visionLayout?: {
    regions: Array<Record<string, unknown>>;
    elements: Array<Record<string, unknown>>;
    tables: Array<Record<string, unknown>>;
    styleClusters: Array<Record<string, unknown>>;
  };
  fusionMap?: Array<{
    binding: string;
    valueText?: string;
    ocrWordIds: string[];
    layoutNodeIds: string[];
    boundingBox?: { x: number; y: number; width: number; height: number };
    confidence: number;
    fieldType: "text" | "currency" | "date" | "number" | "table" | "unknown";
  }>;
  fontMatches?: Array<{
    clusterId: string;
    provider: "external_api" | "fallback";
    matchedFont: string;
    fallbackFont: string;
    confidence: number;
    raw?: Record<string, unknown>;
  }>;
  croppedAssets?: Array<{
    id: string;
    pageIndex: number;
    kind: "logo" | "image";
    imageUrl: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;
  quality?: { overall: number; layout: number; text: number; table: number; font: number };
  needsReview?: boolean;
  reviewReasons?: string[];
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
