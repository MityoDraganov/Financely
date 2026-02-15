export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NormalizedBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PolygonPoint = {
  x: number;
  y: number;
};

export type DocumentPage = {
  pageIndex: number;
  width: number;
  height: number;
  imageUrl: string;
  mimeType?: string;
  source: "original" | "rendered_pdf";
};

export type OCRWord = {
  id: string;
  text: string;
  confidence: number;
  pageIndex: number;
  boundingBox: BoundingBox;
  normalizedBoundingBox: NormalizedBoundingBox;
  polygon: PolygonPoint[];
};

export type VisionLayoutRegion = {
  id: string;
  pageIndex: number;
  kind: "header" | "parties" | "meta" | "table" | "totals" | "footer" | "misc";
  boundingBox: BoundingBox;
  confidence: number;
};

export type VisionLayoutElement = {
  id: string;
  pageIndex: number;
  kind: "label" | "value" | "text" | "logo" | "image" | "table" | "table_header" | "table_cell" | "line" | "other";
  text?: string;
  boundingBox: BoundingBox;
  confidence: number;
  styleClusterId?: string;
  bindingHint?: string;
  currencyLike?: boolean;
};

export type VisionLayoutTable = {
  id: string;
  pageIndex: number;
  boundingBox: BoundingBox;
  columnHeaders: string[];
  columns?: Array<{
    id: string;
    header?: string;
    boundingBox?: BoundingBox;
    type?: "text" | "number" | "date" | "currency" | "unknown";
    confidence: number;
  }>;
  headerBoundingBox?: BoundingBox;
  rowCount: number;
  confidence: number;
};

export type VisionStyleCluster = {
  id: string;
  fontFamilyHint?: string;
  fontWeightHint?: string;
  fontSizePx?: number;
  color?: string;
  sampleTexts: string[];
  confidence: number;
};

export type VisionLayout = {
  regions: VisionLayoutRegion[];
  elements: VisionLayoutElement[];
  tables: VisionLayoutTable[];
  styleClusters: VisionStyleCluster[];
};

export type FusionMapEntry = {
  binding: string;
  valueText?: string;
  ocrWordIds: string[];
  layoutNodeIds: string[];
  boundingBox?: BoundingBox;
  confidence: number;
  fieldType: "text" | "currency" | "date" | "number" | "table" | "unknown";
};

export type FontMatch = {
  clusterId: string;
  provider: "external_api" | "fallback";
  matchedFont: string;
  fallbackFont: string;
  confidence: number;
  raw?: Record<string, unknown>;
};

export type TemplateQuality = {
  overall: number;
  layout: number;
  text: number;
  table: number;
  font: number;
};

export const DEFAULT_TEMPLATE_QUALITY: TemplateQuality = {
  overall: 0.5,
  layout: 0.5,
  text: 0.5,
  table: 0.5,
  font: 0.5,
};
