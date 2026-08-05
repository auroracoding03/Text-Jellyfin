export type DocumentFormat = "md" | "txt" | "docx" | "pdf" | "unknown";

export type ExtractionStatus =
  | "ready"
  | "warning"
  | "needs_ocr"
  | "unsupported"
  | "failed"
  | "absent";

export interface DocumentRecord {
  id: string;
  relativePath: string;
  format: DocumentFormat;
  title: string;
  summary: string;
  author: string | null;
  series: string | null;
  chapter: number | null;
  language: string | null;
  tags: string[];
  fileSize: number;
  mtimeMs: number;
  contentHash: string;
  sidecarHash: string | null;
  cacheKey: string | null;
  articleHtmlPath: string | null;
  plainText: string;
  wordCount: number;
  readingTimeMinutes: number;
  adapterName: string | null;
  adapterVersion: string | null;
  status: ExtractionStatus;
  warnings: string[];
  indexedAt: string | null;
  createdAt: string;
  updatedAt: string;
  absent: boolean;
}

export interface DocumentFilters {
  q?: string;
  tag?: string;
  format?: DocumentFormat | "";
  status?: ExtractionStatus | "";
}

export interface ScanRunSummary {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  scanned: number;
  added: number;
  updated: number;
  skipped: number;
  failed: number;
  removed: number;
  message: string | null;
}

export interface LibraryStats {
  total: number;
  ready: number;
  warning: number;
  needsOcr: number;
  failed: number;
  unsupported: number;
  byFormat: Record<string, number>;
}
