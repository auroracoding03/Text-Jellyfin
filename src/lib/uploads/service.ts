import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { getDocumentByPath } from "@/lib/catalog/queries";
import { scanLibrary } from "@/lib/ingest/scanner";
import { writeSidecar } from "@/lib/ingest/metadata";
import { assertWithinRoot, ensureDir, toPosixRelative } from "@/lib/security/paths";

export type UploadFormat = "md" | "txt";

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
  }
}

function normalizeFormat(value: string): UploadFormat {
  if (value === "md" || value === "markdown") return "md";
  if (value === "txt" || value === "text") return "txt";
  throw new UploadError("Only Markdown and plain-text uploads are supported.");
}

function safeStem(value: string): string {
  const stem = value
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9 _-]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[- ]{2,}/g, "-")
    .replace(/^[-. ]+|[-. ]+$/g, "")
    .slice(0, 100);
  return stem || "untitled";
}

function writeUpload(
  stem: string,
  format: UploadFormat,
  content: Buffer,
  subdirectory?: string,
): string {
  if (!content.length) throw new UploadError("Upload content cannot be empty.");
  if (content.length > config.maxUploadBytes) {
    throw new UploadError(
      `Upload exceeds the ${config.maxUploadBytes} byte upload limit.`,
      413,
    );
  }

  ensureDir(config.uploadsPath);
  const targetDir = subdirectory
    ? path.join(config.uploadsPath, subdirectory)
    : config.uploadsPath;
  ensureDir(targetDir);
  const directory = assertWithinRoot(config.libraryPath, targetDir);
  const extension = format === "md" ? ".md" : ".txt";
  const base = safeStem(stem);

  for (let index = 0; index < 100; index += 1) {
    const suffix = index ? `-${index + 1}` : "";
    const filename = `${base}${suffix}${extension}`;
    const candidate = assertWithinRoot(directory, path.join(directory, filename));
    try {
      fs.writeFileSync(candidate, content, { flag: "wx" });
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
      throw error;
    }
  }

  throw new UploadError("Could not create a unique filename for this upload.", 409);
}

function normalizeSummary(value: string | undefined): string | undefined {
  const summary = value?.trim();
  if (!summary) return undefined;
  if (summary.length > 500) {
    throw new UploadError("A teaser must be 500 characters or fewer.");
  }
  return summary;
}

function writeUploadMetadata(
  absolutePath: string,
  input: {
    title?: string;
    summary?: string;
    tags?: string[];
    origin: "paste" | "file";
  },
): void {
  const title = input.title?.trim() || undefined;
  const summary = normalizeSummary(input.summary);
  const tags = input.tags?.map((tag) => tag.trim()).filter(Boolean);
  writeSidecar(absolutePath, {
    title,
    summary,
    tags,
    origin: input.origin,
  });
}

async function indexUpload(absolutePath: string) {
  const relativePath = toPosixRelative(config.libraryPath, absolutePath);
  const scan = await scanLibrary();
  const document = getDocumentByPath(relativePath);
  return {
    relativePath,
    documentId: document?.id || null,
    scan,
  };
}

export async function uploadText(input: {
  title: string;
  format: string;
  text: string;
  summary?: string;
  tags?: string[];
}) {
  const format = normalizeFormat(input.format);
  const title = input.title.trim();
  if (!title) throw new UploadError("A title is required for pasted text.");
  const absolutePath = writeUpload(title, format, Buffer.from(input.text, "utf8"), "pasted");
  writeUploadMetadata(absolutePath, {
    title,
    summary: input.summary,
    tags: input.tags,
    origin: "paste",
  });
  return indexUpload(absolutePath);
}

export async function uploadFile(input: {
  filename: string;
  content: Buffer;
  title?: string;
  summary?: string;
  tags?: string[];
}) {
  const extension = path.extname(input.filename).toLowerCase();
  const format = normalizeFormat(extension.slice(1));
  const stem = input.title?.trim() || path.basename(input.filename, extension);
  const absolutePath = writeUpload(stem, format, input.content);
  writeUploadMetadata(absolutePath, {
    title: input.title,
    summary: input.summary,
    tags: input.tags,
    origin: "file",
  });
  return indexUpload(absolutePath);
}
