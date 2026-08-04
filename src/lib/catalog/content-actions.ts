import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import { getDocumentById } from "@/lib/catalog/queries";
import { scanLibrary } from "@/lib/ingest/scanner";
import { assertRealPathWithinRoot } from "@/lib/security/paths";

export class ContentEditError extends Error {}

export function canEditSource(format: string): boolean {
  return format === "md" || format === "txt";
}

function editableSource(id: string) {
  const document = getDocumentById(id);
  if (!document) throw new ContentEditError("Document not found.");
  if (!canEditSource(document.format)) {
    throw new ContentEditError("Only Markdown and plain-text source files can be edited here.");
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
