import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import YAML from "yaml";
import type { ExtractedMetadata } from "@/lib/ingest/types";

export function sidecarPathFor(sourcePath: string): string {
  return `${sourcePath}.meta.yaml`;
}

export function titleFromFilename(relativePath: string): string {
  const base = path.basename(relativePath).replace(/\.[^.]+$/, "");
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function summaryFromText(text: string, maxLength = 220): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

export function readSidecar(sourcePath: string): {
  metadata: ExtractedMetadata;
  hash: string | null;
  exists: boolean;
} {
  const sidecar = sidecarPathFor(sourcePath);
  if (!fs.existsSync(sidecar)) {
    return { metadata: {}, hash: null, exists: false };
  }

  const raw = fs.readFileSync(sidecar, "utf8");
  const parsed = YAML.parse(raw) || {};
  const metadata: ExtractedMetadata = {
    title: typeof parsed.title === "string" ? parsed.title : undefined,
    summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
    author: typeof parsed.author === "string" ? parsed.author : undefined,
    series: typeof parsed.series === "string" ? parsed.series : undefined,
    language: typeof parsed.language === "string" ? parsed.language : undefined,
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag: unknown) => typeof tag === "string")
      : undefined,
    origin:
      parsed.origin === "paste" || parsed.origin === "file"
        ? parsed.origin
        : undefined,
  };

  return {
    metadata,
    hash: hashString(raw),
    exists: true,
  };
}

export function writeSidecar(
  sourcePath: string,
  metadata: ExtractedMetadata,
): void {
  const payload = {
    title: metadata.title || undefined,
    summary: metadata.summary || undefined,
    author: metadata.author || undefined,
    series: metadata.series || undefined,
    language: metadata.language || undefined,
    tags: metadata.tags?.length ? metadata.tags : undefined,
    origin: metadata.origin || undefined,
  };

  fs.writeFileSync(sidecarPathFor(sourcePath), YAML.stringify(payload), "utf8");
}

export function mergeMetadata(
  relativePath: string,
  sidecar: ExtractedMetadata,
  embedded: ExtractedMetadata,
  plainText: string,
): Required<
  Pick<ExtractedMetadata, "title" | "summary" | "tags">
> &
  ExtractedMetadata {
  const title =
    sidecar.title || embedded.title || titleFromFilename(relativePath);
  const summary =
    sidecar.summary ||
    embedded.summary ||
    summaryFromText(plainText);
  const tags = uniqueTags([...(sidecar.tags || []), ...(embedded.tags || [])]);

  return {
    title,
    summary,
    tags,
    author: sidecar.author || embedded.author,
    series: sidecar.series || embedded.series,
    language: sidecar.language || embedded.language,
  };
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result.sort();
}

export function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
