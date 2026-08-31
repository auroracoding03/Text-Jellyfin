import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { getDocumentByPath, listDocumentsBySeries } from "@/lib/catalog/queries";
import { resolveChapterNumber } from "@/lib/catalog/series";
import { scanLibrary } from "@/lib/ingest/scanner";
import { writeSidecar } from "@/lib/ingest/metadata";
import {
  NoteAssetError,
  deleteNoteAssetsDir,
  persistNoteAssets,
  type NoteImageInput,
} from "@/lib/notes/assets";
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
  const normalized = value.trim().toLowerCase();
  if (normalized === "md" || normalized === "markdown") return "md";
  if (normalized === "txt" || normalized === "text") return "txt";
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

function normalizeSeries(value: string | undefined): string | undefined {
  const series = value?.trim();
  return series || undefined;
}

function normalizeAuthor(value: string | undefined): string | undefined {
  const author = value?.trim();
  return author || undefined;
}

function parseChapterInput(value: string | number | undefined): number | undefined {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1) {
      throw new UploadError("Chapter must be a positive whole number.");
    }
    return Math.floor(value);
  }
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (!/^\d+$/.test(trimmed)) {
    throw new UploadError("Chapter must be a positive whole number.");
  }
  const chapter = Number(trimmed);
  if (chapter < 1) throw new UploadError("Chapter must be a positive whole number.");
  return chapter;
}

function nextChapterForSeries(series: string): number {
  const chapters = listDocumentsBySeries(series);
  let max = 0;
  for (const document of chapters) {
    const number =
      document.chapter ?? resolveChapterNumber(document.title) ?? 0;
    if (number > max) max = number;
  }
  return max + 1;
}

function resolveUploadChapter(input: {
  title?: string;
  series?: string;
  chapter?: string | number;
}): number | undefined {
  const explicit = parseChapterInput(input.chapter);
  if (explicit) return explicit;
  if (input.title) {
    const fromTitle = resolveChapterNumber(input.title);
    if (fromTitle) return fromTitle;
  }
  if (input.series) return nextChapterForSeries(input.series);
  return undefined;
}

function writeUploadMetadata(
  absolutePath: string,
  input: {
    title?: string;
    summary?: string;
    author?: string;
    series?: string;
    chapter?: number;
    tags?: string[];
    origin: "paste" | "file";
  },
): void {
  const title = input.title?.trim() || undefined;
  const summary = normalizeSummary(input.summary);
  const author = normalizeAuthor(input.author);
  const series = normalizeSeries(input.series);
  const tags = input.tags?.map((tag) => tag.trim()).filter(Boolean);
  writeSidecar(absolutePath, {
    title,
    summary,
    author,
    series,
    chapter: input.chapter,
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

function saveNoteImages(
  absolutePath: string,
  markdown: string,
  images: NoteImageInput[] | undefined,
  prune: boolean,
) {
  if (!images?.length && !/note-assets\//.test(markdown)) return;
  try {
    persistNoteAssets({
      markdownPath: absolutePath,
      markdown,
      images: images || [],
      prune,
    });
  } catch (error) {
    if (error instanceof NoteAssetError) {
      throw new UploadError(error.message, error.status);
    }
    throw error;
  }
}

export async function uploadText(input: {
  title: string;
  format: string;
  text: string;
  summary?: string;
  author?: string;
  series?: string;
  chapter?: string | number;
  tags?: string[];
  images?: NoteImageInput[];
}) {
  const format = normalizeFormat(input.format);
  const title = input.title.trim();
  if (!title) throw new UploadError("A title is required for pasted text.");
  if (format !== "md" && input.images?.length) {
    throw new UploadError("Images can only be attached to Markdown notes.");
  }
  const author = normalizeAuthor(input.author);
  const series = normalizeSeries(input.series);
  const chapter = resolveUploadChapter({ title, series, chapter: input.chapter });
  const absolutePath = writeUpload(title, format, Buffer.from(input.text, "utf8"), "pasted");
  try {
    writeUploadMetadata(absolutePath, {
      title,
      summary: input.summary,
      author,
      series,
      chapter,
      tags: input.tags,
      origin: "paste",
    });
    if (format === "md") {
      saveNoteImages(absolutePath, input.text, input.images, false);
    }
  } catch (error) {
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    const sidecar = `${absolutePath}.meta.yaml`;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    try {
      deleteNoteAssetsDir(absolutePath);
    } catch {
      // Best effort; the note file is already removed.
    }
    throw error;
  }
  return indexUpload(absolutePath);
}

export async function uploadFile(input: {
  filename: string;
  content: Buffer;
  title?: string;
  summary?: string;
  author?: string;
  series?: string;
  chapter?: string | number;
  tags?: string[];
}) {
  const extension = path.extname(input.filename).toLowerCase();
  const format = normalizeFormat(extension.slice(1));
  const stem = input.title?.trim() || path.basename(input.filename, extension);
  const author = normalizeAuthor(input.author);
  const series = normalizeSeries(input.series);
  const chapter = resolveUploadChapter({
    title: input.title?.trim() || stem,
    series,
    chapter: input.chapter,
  });
  const absolutePath = writeUpload(stem, format, input.content);
  writeUploadMetadata(absolutePath, {
    title: input.title,
    summary: input.summary,
    author,
    series,
    chapter,
    tags: input.tags,
    origin: "file",
  });
  return indexUpload(absolutePath);
}
