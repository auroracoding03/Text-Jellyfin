import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { detectImageContentType } from "@/lib/notes/assets";
import {
  assertRealPathWithinRoot,
  assertWithinRoot,
} from "@/lib/security/paths";

export class CoverImageError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
  }
}

export const COVER_FILENAME_SUFFIX = ".cover.jpg";

export function coverPathFor(sourcePath: string): string {
  const directory = path.dirname(sourcePath);
  const stem = path.basename(sourcePath, path.extname(sourcePath));
  return path.join(directory, `${stem}${COVER_FILENAME_SUFFIX}`);
}

export function coverExistsFor(sourcePath: string): boolean {
  try {
    return Boolean(resolveCoverPath(sourcePath));
  } catch {
    return false;
  }
}

export function coverMtimeMs(sourcePath: string): number {
  const coverPath = coverPathFor(sourcePath);
  try {
    if (!fs.existsSync(coverPath)) return 0;
    return fs.statSync(coverPath).mtimeMs;
  } catch {
    return 0;
  }
}

export function validateCoverImage(data: Buffer): void {
  if (!data.length) {
    throw new CoverImageError("Cover image is empty.");
  }
  if (data.length > config.maxNoteImageBytes) {
    throw new CoverImageError(
      `Each image must be ${config.maxNoteImageBytes} bytes or smaller after compression.`,
      413,
    );
  }
  if (!detectImageContentType(data)) {
    throw new CoverImageError("Only JPEG, PNG, and WebP images are supported.");
  }
}

export function persistCover(sourcePath: string, data: Buffer): void {
  validateCoverImage(data);
  const coverPath = coverPathFor(sourcePath);
  const safeSource = assertWithinRoot(config.libraryPath, sourcePath);
  const safeCover = assertWithinRoot(
    path.dirname(safeSource),
    coverPath,
  );
  fs.writeFileSync(safeCover, data);
}

export function deleteCoverFile(sourcePath: string): void {
  const coverPath = coverPathFor(sourcePath);
  if (!fs.existsSync(coverPath)) return;
  const safeSource = assertWithinRoot(config.libraryPath, sourcePath);
  const safeCover = assertWithinRoot(path.dirname(safeSource), coverPath);
  fs.unlinkSync(safeCover);
}

export function resolveCoverPath(sourcePath: string): string | null {
  const coverPath = coverPathFor(sourcePath);
  try {
    const safeSource = assertWithinRoot(config.libraryPath, sourcePath);
    const safeCover = assertWithinRoot(path.dirname(safeSource), coverPath);
    if (!fs.existsSync(safeCover)) return null;
    return assertRealPathWithinRoot(config.libraryPath, safeCover);
  } catch {
    return null;
  }
}

export async function coverFromFormData(
  formData: FormData,
): Promise<Buffer | null | "clear"> {
  const clearValue = formData.get("clearCover");
  if (clearValue === "true" || clearValue === "1") {
    return "clear";
  }

  const value = formData.get("cover");
  if (!value || typeof value === "string" || typeof value.arrayBuffer !== "function") {
    return null;
  }
  return Buffer.from(await value.arrayBuffer());
}
