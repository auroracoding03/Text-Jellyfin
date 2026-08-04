import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import { getDocumentById } from "@/lib/catalog/queries";
import type { DocumentRecord } from "@/lib/catalog/types";
import { readSidecar } from "@/lib/ingest/metadata";
import { scanLibrary } from "@/lib/ingest/scanner";
import { assertRealPathWithinRoot } from "@/lib/security/paths";

export class ContentEditError extends Error {}

export function canEditFormat(format: string): boolean {
  return format === "md" || format === "txt";
}

/**
 * Body editing is for pasted notes only — not for distinct library files
 * (PDF/DOCX/uploaded files) that are indexed as read-only sources.
 */
export function canEditContent(document: DocumentRecord): boolean {
  if (!canEditFormat(document.format)) return false;

  const relativePath = document.relativePath.replace(/\\/g, "/");
  if (relativePath.startsWith("uploads/pasted/")) return true;

  try {
    const absolutePath = assertRealPathWithinRoot(
      config.libraryPath,
      path.join(config.libraryPath, document.relativePath),
    );
    const origin = readSidecar(absolutePath).metadata.origin;
    if (origin === "paste") return true;
    if (origin === "file") return false;
  } catch {
    return false;
  }

  // Legacy paste uploads lived directly under uploads/ without an origin marker.
  return /^uploads\/[^/]+\.(md|txt)$/i.test(relativePath);
}

/** @deprecated Prefer canEditContent(document) */
export function canEditSource(format: string): boolean {
  return canEditFormat(format);
}

function editableSource(id: string) {
  const document = getDocumentById(id);
  if (!document) throw new ContentEditError("Document not found.");
  if (!canEditContent(document)) {
    throw new ContentEditError(
      "Only pasted Markdown and plain-text notes can be edited here.",
    );
  }

  return {
    document,
    absolutePath: assertRealPathWithinRoot(
      config.libraryPath,
      path.join(config.libraryPath, document.relativePath),
    ),
  };
}

export function readEditableSource(id: string): string {
  const { absolutePath } = editableSource(id);
  return fs.readFileSync(absolutePath, "utf8");
}

export async function updateDocumentContent(id: string, content: string): Promise<void> {
  if (typeof content !== "string" || !content.trim()) {
    throw new ContentEditError("Article text cannot be empty.");
  }
  if (Buffer.byteLength(content, "utf8") > config.maxUploadBytes) {
    throw new ContentEditError("Article text exceeds the configured upload limit.");
  }

  const { absolutePath } = editableSource(id);
  const tempPath = `${absolutePath}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tempPath, content, "utf8");
    fs.renameSync(tempPath, absolutePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
  await scanLibrary();
}
