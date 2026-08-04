import path from "node:path";
import { config } from "@/lib/config";
import { getDocumentById } from "@/lib/catalog/queries";
import { writeSidecar } from "@/lib/ingest/metadata";
import { assertWithinRoot } from "@/lib/security/paths";
import { scanLibrary } from "@/lib/ingest/scanner";

export async function updateDocumentMetadata(
  id: string,
  input: {
    title: string;
    summary: string;
    author: string;
    series: string;
    language: string;
    tags: string[];
  },
) {
  const document = getDocumentById(id);
  if (!document) {
    throw new Error("Document not found");
  }

  const absolutePath = assertWithinRoot(
    config.libraryPath,
    path.join(config.libraryPath, document.relativePath),
  );

  writeSidecar(absolutePath, {
    title: input.title.trim() || undefined,
    summary: input.summary.trim() || undefined,
    author: input.author.trim() || undefined,
    series: input.series.trim() || undefined,
    language: input.language.trim() || undefined,
    tags: input.tags,
  });

  // Re-scan so catalog and cache key stay aligned with sidecar hash.
  await scanLibrary();
}
