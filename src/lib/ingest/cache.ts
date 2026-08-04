import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import {
  assertRealPathWithinRoot,
  assertWithinRoot,
  ensureDir,
} from "@/lib/security/paths";
import type { AdapterAsset } from "@/lib/ingest/types";

function isSafeFilename(filename: string): boolean {
  return (
    filename === path.basename(filename) &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename) &&
    !filename.includes("..")
  );
}

function writeFileAtomically(filePath: string, data: string | Buffer): void {
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tempPath, data);
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

export function buildCacheKey(
  contentHash: string,
  sidecarHash: string | null,
  adapterName: string,
  adapterVersion: string,
): string {
  return [contentHash.slice(0, 16), sidecarHash?.slice(0, 12) || "noside", adapterName, adapterVersion].join(
    "-",
  );
}

export function cacheDirFor(documentId: string, cacheKey: string): string {
  return path.join(config.cachePath, documentId, cacheKey);
}

export function writeArticleCache(options: {
  documentId: string;
  cacheKey: string;
  html: string;
  assets: AdapterAsset[];
}): { articleHtmlPath: string; assetDir: string } {
  if (!options.assets.every((asset) => isSafeFilename(asset.filename))) {
    throw new Error("Cache asset filename must be a simple filename");
  }

  const dir = cacheDirFor(options.documentId, options.cacheKey);
  ensureDir(dir);
  ensureDir(path.join(dir, "assets"));

  const articleHtmlPath = path.join(dir, "article.html");
  writeFileAtomically(articleHtmlPath, options.html);

  for (const asset of options.assets) {
    writeFileAtomically(path.join(dir, "assets", asset.filename), asset.data);
  }

  return {
    articleHtmlPath,
    assetDir: path.join(dir, "assets"),
  };
}

export function readArticleHtml(articleHtmlPath: string | null): string {
  if (!articleHtmlPath || !fs.existsSync(articleHtmlPath)) {
    return "";
  }
  const safePath = assertRealPathWithinRoot(config.cachePath, articleHtmlPath);
  return fs.readFileSync(safePath, "utf8");
}

export function resolveCacheAsset(
  documentId: string,
  cacheKey: string,
  filename: string,
): string | null {
  if (!isSafeFilename(filename)) return null;
  const candidate = path.join(cacheDirFor(documentId, cacheKey), "assets", filename);
  if (!fs.existsSync(candidate)) return null;
  return assertWithinRoot(config.cachePath, candidate);
}
