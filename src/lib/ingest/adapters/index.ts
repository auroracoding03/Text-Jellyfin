import type { DocumentFormat } from "@/lib/catalog/types";
import { docxAdapter } from "@/lib/ingest/adapters/docx";
import { markdownAdapter } from "@/lib/ingest/adapters/markdown";
import { pdfAdapter } from "@/lib/ingest/adapters/pdf";
import { textAdapter } from "@/lib/ingest/adapters/text";
import type { FormatAdapter } from "@/lib/ingest/types";

const adapters: FormatAdapter[] = [
  markdownAdapter,
  textAdapter,
  docxAdapter,
  pdfAdapter,
];

export function getAdapter(format: DocumentFormat): FormatAdapter | null {
  return adapters.find((adapter) => adapter.formats.includes(format)) || null;
}

export function formatFromExtension(filename: string): DocumentFormat {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "md":
    case "markdown":
      return "md";
    case "txt":
      return "txt";
    case "docx":
      return "docx";
    case "pdf":
      return "pdf";
    default:
      return "unknown";
  }
}

export { adapters };
