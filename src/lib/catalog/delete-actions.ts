import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { deleteDocumentRecord, getDocumentById } from "@/lib/catalog/queries";
import { deleteCoverFile } from "@/lib/catalog/cover";
import { sidecarPathFor } from "@/lib/ingest/metadata";
import { deleteNoteAssetsDir } from "@/lib/notes/assets";
import { assertRealPathWithinRoot, assertWithinRoot } from "@/lib/security/paths";

export class DocumentDeleteError extends Error {}

export function deleteDocument(id: string): { relativePath: string } {
  const document = getDocumentById(id);
  if (!document) throw new DocumentDeleteError("Document not found.");

  const absolutePath = assertRealPathWithinRoot(
    config.libraryPath,
    path.join(config.libraryPath, document.relativePath),
  );

  if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);

  // Sidecar is always absolutePath + ".meta.yaml"; absolutePath is already rooted.
  const sidecarPath = sidecarPathFor(absolutePath);
  if (sidecarPath !== `${absolutePath}.meta.yaml`) {
    throw new DocumentDeleteError("Invalid sidecar path.");
  }
  if (fs.existsSync(sidecarPath)) fs.unlinkSync(sidecarPath);

  try {
    deleteCoverFile(absolutePath);
  } catch {
    // Best effort: the source file is already gone.
  }

  try {
    deleteNoteAssetsDir(absolutePath);
  } catch {
    // Best effort: the source note is already gone.
  }

  const cacheDocumentDir = path.join(config.cachePath, document.id);
  if (fs.existsSync(cacheDocumentDir)) {
    const safeCacheDir = assertWithinRoot(config.cachePath, cacheDocumentDir);
    fs.rmSync(safeCacheDir, { recursive: true, force: true });
  }

  deleteDocumentRecord(document.id);
  return { relativePath: document.relativePath };
}
