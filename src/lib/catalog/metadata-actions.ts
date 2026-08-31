import path from "node:path";
import { config } from "@/lib/config";
import {
  CoverImageError,
  deleteCoverFile,
  persistCover,
} from "@/lib/catalog/cover";
import { getDocumentById } from "@/lib/catalog/queries";
import { readSidecar, writeSidecar } from "@/lib/ingest/metadata";
import { assertWithinRoot } from "@/lib/security/paths";
import { scanLibrary } from "@/lib/ingest/scanner";

export async function updateDocumentMetadata(
  id: string,
  input: Partial<{
    title: string;
    summary: string;
    author: string;
    series: string;
    chapter: number | null;
    language: string;
    tags: string[];
  }>,
  cover?: Buffer | null | "clear",
) {
  const document = getDocumentById(id);
  if (!document) {
    throw new Error("Document not found");
  }

  const absolutePath = assertWithinRoot(
    config.libraryPath,
    path.join(config.libraryPath, document.relativePath),
  );
  const existing = readSidecar(absolutePath);

  let chapter: number | undefined;
  if (input.chapter === undefined) {
    chapter = document.chapter || undefined;
  } else if (input.chapter === null) {
    chapter = undefined;
  } else if (!Number.isFinite(input.chapter) || input.chapter < 1) {
    throw new Error("Chapter must be a positive whole number.");
  } else {
    chapter = Math.floor(input.chapter);
  }

  const nextCover =
    cover === "clear" ? false : Buffer.isBuffer(cover) ? true : existing.hasCover;

  if (Buffer.isBuffer(cover)) {
    try {
      persistCover(absolutePath, cover);
    } catch (error) {
      if (error instanceof CoverImageError) {
        throw new Error(error.message);
      }
      throw error;
    }
  } else if (cover === "clear") {
    deleteCoverFile(absolutePath);
  }

  writeSidecar(absolutePath, {
    title: input.title === undefined ? document.title : input.title.trim() || undefined,
    summary:
      input.summary === undefined ? document.summary : input.summary.trim() || undefined,
    author: input.author === undefined ? document.author || undefined : input.author.trim() || undefined,
    series: input.series === undefined ? document.series || undefined : input.series.trim() || undefined,
    chapter,
    language:
      input.language === undefined ? document.language || undefined : input.language.trim() || undefined,
    tags: input.tags === undefined ? document.tags : input.tags,
    origin: existing.metadata.origin,
  }, {
    cover: nextCover,
  });

  // Re-scan so catalog and cache key stay aligned with sidecar hash.
  await scanLibrary();
}
