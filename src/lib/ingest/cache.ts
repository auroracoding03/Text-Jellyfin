import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { ensureDir } from "@/lib/security/paths";
import type { AdapterAsset } from "@/lib/ingest/types";

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
  const dir = cacheDirFor(options.documentId, options.cacheKey);
  ensureDir(dir);
  ensureDir(path.join(dir, "assets"));

  const articleHtmlPath = path.join(dir, "article.html");
  fs.writeFileSync(articleHtmlPath, options.html, "utf8");

  for (const asset of options.assets) {
    fs.writeFileSync(path.join(dir, "assets", asset.filename), asset.data);
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
  return fs.readFileSync(articleHtmlPath, "utf8");
}

export function resolveCacheAsset(
  documentId: string,
  cacheKey: string,
  filename: string,
): string | null {
  const candidate = path.join(cacheDirFor(documentId, cacheKey), "assets", filename);
  if (!fs.existsSync(candidate)) return null;
  return candidate;
}
