import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import {
  finishScanRun,
  getDocumentByPath,
  markMissingDocuments,
  startScanRun,
  upsertDocument,
} from "@/lib/catalog/queries";
import type { DocumentFormat, ScanRunSummary } from "@/lib/catalog/types";
import { formatFromExtension, getAdapter } from "@/lib/ingest/adapters";
import { buildCacheKey, writeArticleCache } from "@/lib/ingest/cache";
import { mergeMetadata, readSidecar } from "@/lib/ingest/metadata";
import { assertWithinRoot, ensureDir, toPosixRelative } from "@/lib/security/paths";

const SUPPORTED_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".docx", ".pdf"]);

export interface ScanResult {
  runId: number;
  scanned: number;
  added: number;
  updated: number;
  skipped: number;
  failed: number;
  removed: number;
  message: string;
}

function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function documentIdFor(relativePath: string): string {
  return createHash("sha1").update(relativePath).digest("hex").slice(0, 16);
}

function walkLibrary(root: string): string[] {
  const results: string[] = [];

  const visit = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".")) continue;
        visit(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name.endsWith(".meta.yaml")) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
      results.push(absolute);
    }
  };

  visit(root);
  return results;
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Timed out extracting ${label}`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let activeScan: Promise<ScanResult> | null = null;

export function scanLibrary(): Promise<ScanResult> {
  if (activeScan) return activeScan;
  activeScan = scanLibraryInternal().finally(() => {
    activeScan = null;
  });
  return activeScan;
}

async function scanLibraryInternal(): Promise<ScanResult> {
  ensureDir(config.dataPath);
  ensureDir(config.cachePath);
  ensureDir(config.libraryPath);

  const runId = startScanRun();
  let scanned = 0;
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let removed = 0;

  try {
    const presentPaths = new Set<string>();
    const files = walkLibrary(config.libraryPath);

    for (const absolutePath of files) {
      const safePath = assertWithinRoot(config.libraryPath, absolutePath);
      const relativePath = toPosixRelative(config.libraryPath, safePath);
      presentPaths.add(relativePath);
      scanned += 1;

      try {
        const stat = fs.statSync(safePath);
        if (stat.size > config.maxFileBytes) {
          failed += 1;
          upsertDocument({
          id: documentIdFor(relativePath),
          relativePath,
          format: formatFromExtension(safePath),
          title: path.basename(relativePath),
          summary: "",
          author: null,
          series: null,
          chapter: null,
          language: null,
          tags: [],
          fileSize: stat.size,
          mtimeMs: stat.mtimeMs,
          contentHash: "oversized",
          sidecarHash: null,
          cacheKey: null,
          articleHtmlPath: null,
          plainText: "",
          wordCount: 0,
          readingTimeMinutes: 0,
          adapterName: null,
          adapterVersion: null,
          status: "failed",
          warnings: [`File exceeds max size of ${config.maxFileBytes} bytes.`],
          indexedAt: new Date().toISOString(),
          absent: false,
          });
          continue;
        }

        const format = formatFromExtension(safePath);
        const sidecar = readSidecar(safePath);
        const existing = getDocumentByPath(relativePath);

        const adapter = getAdapter(format);
        if (!adapter) {
          const contentHash = await hashFile(safePath);
          upsertDocument({
          id: documentIdFor(relativePath),
          relativePath,
          format,
          title: path.basename(relativePath),
          summary: "",
          author: null,
          series: null,
          chapter: null,
          language: null,
          tags: [],
          fileSize: stat.size,
          mtimeMs: stat.mtimeMs,
          contentHash,
          sidecarHash: sidecar.hash,
          cacheKey: null,
          articleHtmlPath: null,
          plainText: "",
          wordCount: 0,
          readingTimeMinutes: 0,
          adapterName: null,
          adapterVersion: null,
          status: "unsupported",
          warnings: [`Unsupported format: ${format}`],
          indexedAt: new Date().toISOString(),
          absent: false,
          });
          failed += 1;
          continue;
        }

        if (
          existing &&
          !existing.absent &&
          existing.fileSize === stat.size &&
          existing.mtimeMs === stat.mtimeMs &&
          existing.sidecarHash === sidecar.hash &&
          existing.adapterName === adapter.name &&
          existing.adapterVersion === adapter.version &&
          existing.articleHtmlPath &&
          fs.existsSync(existing.articleHtmlPath)
        ) {
          skipped += 1;
          continue;
        }

        const contentHash = await hashFile(safePath);

        const cacheKey = buildCacheKey(
          contentHash,
          sidecar.hash,
          adapter.name,
          adapter.version,
        );

        if (
          existing &&
          !existing.absent &&
          existing.contentHash === contentHash &&
          existing.sidecarHash === sidecar.hash &&
          existing.cacheKey === cacheKey &&
          existing.articleHtmlPath &&
          fs.existsSync(existing.articleHtmlPath)
        ) {
          skipped += 1;
          continue;
        }

        const documentId = existing?.id || documentIdFor(relativePath);
        const assetBaseUrl = `/api/works/${documentId}/assets`;

        const extracted = await withTimeout(
          (signal) => adapter.extract({
          absolutePath: safePath,
          relativePath,
          format: format as DocumentFormat,
          contentHash,
          assetBaseUrl,
            signal,
          }),
          config.adapterTimeoutMs,
          relativePath,
        );

        const metadata = mergeMetadata(
        relativePath,
        sidecar.metadata,
        extracted.metadata,
        extracted.plainText,
      );

        const wordCount = extracted.plainText
        ? extracted.plainText.trim().split(/\s+/).filter(Boolean).length
        : 0;
        const readingTimeMinutes = Math.max(
        1,
        Math.ceil(wordCount / config.wordsPerMinute),
      );

        let articleHtmlPath: string | null = null;
        let finalCacheKey: string | null = cacheKey;

        if (extracted.html) {
          const cached = writeArticleCache({
          documentId,
          cacheKey,
          html: extracted.html,
          assets: extracted.assets,
        });
          articleHtmlPath = cached.articleHtmlPath;
        } else {
          finalCacheKey = null;
        }

        const action = upsertDocument({
        id: documentId,
        relativePath,
        format,
        title: metadata.title,
        summary: metadata.summary,
        author: metadata.author || null,
        series: metadata.series || null,
        chapter: metadata.chapter || null,
        language: metadata.language || null,
        tags: metadata.tags || [],
        fileSize: stat.size,
        mtimeMs: stat.mtimeMs,
        contentHash,
        sidecarHash: sidecar.hash,
        cacheKey: finalCacheKey,
        articleHtmlPath,
        plainText: extracted.plainText,
        wordCount,
        readingTimeMinutes: extracted.plainText ? readingTimeMinutes : 0,
        adapterName: adapter.name,
        adapterVersion: adapter.version,
        status: extracted.status,
        warnings: extracted.warnings,
        indexedAt: new Date().toISOString(),
        absent: false,
        createdAt: existing?.createdAt,
      });

        if (action === "added") added += 1;
        else updated += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Unknown extraction error";
        const format = formatFromExtension(absolutePath);
        const relative = toPosixRelative(config.libraryPath, absolutePath);
        const stat = fs.existsSync(absolutePath) ? fs.statSync(absolutePath) : null;
        upsertDocument({
        id: documentIdFor(relative),
        relativePath: relative,
        format,
        title: path.basename(relative),
        summary: "",
        author: null,
        series: null,
        chapter: null,
        language: null,
        tags: [],
        fileSize: stat?.size || 0,
        mtimeMs: stat?.mtimeMs || Date.now(),
        contentHash: "failed",
        sidecarHash: null,
        cacheKey: null,
        articleHtmlPath: null,
        plainText: "",
        wordCount: 0,
        readingTimeMinutes: 0,
        adapterName: null,
        adapterVersion: null,
        status: "failed",
        warnings: [message],
        indexedAt: new Date().toISOString(),
        absent: false,
        });
      }
    }

    removed = markMissingDocuments(presentPaths);
    const message = `Scan complete: ${added} added, ${updated} updated, ${skipped} skipped, ${failed} failed, ${removed} removed.`;

    finishScanRun(runId, {
      scanned,
      added,
      updated,
      skipped,
      failed,
      removed,
      message,
    });

    return {
      runId,
      scanned,
      added,
      updated,
      skipped,
      failed,
      removed,
      message,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown scan error";
    finishScanRun(runId, {
      scanned,
      added,
      updated,
      skipped,
      failed: failed + 1,
      removed,
      message: `Scan failed: ${detail}`,
    });
    throw error;
  }
}

export type { ScanRunSummary };
