import type { DocumentFormat, ExtractionStatus } from "@/lib/catalog/types";

export interface ExtractedMetadata {
  title?: string;
  summary?: string;
  author?: string;
  series?: string;
  language?: string;
  tags?: string[];
  /** Marks phone/desktop paste notes vs uploaded or library files. */
  origin?: "paste" | "file";
}

export interface AdapterAsset {
  filename: string;
  contentType: string;
  data: Buffer;
}

export interface AdapterResult {
  metadata: ExtractedMetadata;
  plainText: string;
  html: string;
  assets: AdapterAsset[];
  status: ExtractionStatus;
  warnings: string[];
}

export interface AdapterContext {
  absolutePath: string;
  relativePath: string;
  format: DocumentFormat;
  contentHash: string;
  assetBaseUrl: string;
  signal?: AbortSignal;
}

export interface FormatAdapter {
  name: string;
  version: string;
  formats: DocumentFormat[];
  extract(ctx: AdapterContext): Promise<AdapterResult>;
}

export const ADAPTER_VERSIONS = {
  markdown: "1.0.0",
  text: "1.0.0",
  docx: "1.0.0",
  pdf: "1.0.0",
} as const;
