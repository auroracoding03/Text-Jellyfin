import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { deleteDocumentRecord, getDocumentById } from "@/lib/catalog/queries";
import { sidecarPathFor } from "@/lib/ingest/metadata";
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

  const cacheDocumentDir = path.join(config.cachePath, document.id);
  if (fs.existsSync(cacheDocumentDir)) {
    const safeCacheDir = assertWithinRoot(config.cachePath, cacheDocumentDir);
    fs.rmSync(safeCacheDir, { recursive: true, force: true });
  }

  deleteDocumentRecord(document.id);
  return { relativePath: document.relativePath };
}
