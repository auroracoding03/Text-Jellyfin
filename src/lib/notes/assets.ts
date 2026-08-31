import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import {
  isSafeAssetFilename,
  listNoteAssetFilenames,
} from "@/lib/notes/asset-refs";
import {
  assertRealPathWithinRoot,
  assertWithinRoot,
  ensureDir,
} from "@/lib/security/paths";

export class NoteAssetError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
  }
}

export type NoteImageInput = {
  filename: string;
  data: Buffer;
};

const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function detectImageContentType(data: Buffer): string | null {
  if (data.length >= 3 && data.subarray(0, 3).equals(JPEG_HEADER)) {
    return "image/jpeg";
  }
  if (data.length >= 8 && data.subarray(0, 8).equals(PNG_HEADER)) {
    return "image/png";
  }
  if (
    data.length >= 12 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const EXTENSIONS_FOR_TYPE: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export function noteAssetsDirFor(markdownPath: string): string {
  const directory = path.dirname(markdownPath);
  const stem = path.basename(markdownPath, path.extname(markdownPath));
  return path.join(directory, `${stem}.assets`);
}

export function validateNoteImage(
  filename: string,
  data: Buffer,
): { filename: string; contentType: string } {
  if (!isSafeAssetFilename(filename)) {
    throw new NoteAssetError("Image filename is invalid.");
  }
  if (!data.length) {
    throw new NoteAssetError("Image file is empty.");
  }
  if (data.length > config.maxNoteImageBytes) {
    throw new NoteAssetError(
      `Each image must be ${config.maxNoteImageBytes} bytes or smaller after compression.`,
      413,
    );
  }
  const contentType = detectImageContentType(data);
  if (!contentType) {
    throw new NoteAssetError("Only JPEG, PNG, and WebP images are supported.");
  }
  const extension = path.extname(filename).toLowerCase();
  if (!EXTENSIONS_FOR_TYPE[contentType]?.includes(extension)) {
    throw new NoteAssetError("Image filename does not match the file type.");
  }
  return { filename, contentType };
}

export async function imagesFromFormData(
  formData: FormData,
): Promise<NoteImageInput[]> {
  const images: NoteImageInput[] = [];
  for (const value of formData.getAll("images")) {
    if (typeof value === "string" || typeof value.arrayBuffer !== "function") {
      continue;
    }
    const filename =
      "name" in value && typeof value.name === "string" && value.name
        ? path.basename(value.name)
        : "";
    images.push({
      filename,
      data: Buffer.from(await value.arrayBuffer()),
    });
  }
  return images;
}

export function persistNoteAssets(options: {
  markdownPath: string;
  markdown: string;
  images: NoteImageInput[];
  prune: boolean;
}): void {
  if (/blob:|pending:/i.test(options.markdown)) {
    throw new NoteAssetError(
      "Images failed to attach. Insert them again before saving.",
    );
  }

  const refs = listNoteAssetFilenames(options.markdown);
  if (refs.length > config.maxNoteImages) {
    throw new NoteAssetError(
      `Notes can include at most ${config.maxNoteImages} images.`,
      413,
    );
  }

  const incoming = new Map<string, NoteImageInput>();
  for (const image of options.images) {
    const validated = validateNoteImage(image.filename, image.data);
    incoming.set(validated.filename, {
      filename: validated.filename,
      data: image.data,
    });
  }

  const assetsDir = noteAssetsDirFor(options.markdownPath);

  for (const filename of refs) {
    const uploaded = incoming.get(filename);
    const dest = path.join(assetsDir, filename);
    if (uploaded) {
      ensureDir(assetsDir);
      const safeDir = assertWithinRoot(config.libraryPath, assetsDir);
      const safeDest = assertWithinRoot(safeDir, dest);
      fs.writeFileSync(safeDest, uploaded.data);
    } else if (!fs.existsSync(dest)) {
      throw new NoteAssetError(`Missing image ${filename}.`);
    }
  }

  if (options.prune && fs.existsSync(assetsDir)) {
    const safeDir = assertRealPathWithinRoot(config.libraryPath, assetsDir);
    for (const name of fs.readdirSync(safeDir)) {
      if (refs.includes(name) || !isSafeAssetFilename(name)) continue;
      fs.unlinkSync(assertWithinRoot(safeDir, path.join(safeDir, name)));
    }
    if (fs.readdirSync(safeDir).length === 0) {
      fs.rmdirSync(safeDir);
    }
  }
}

export function resolveSourceNoteAsset(
  markdownPath: string,
  filename: string,
): string | null {
  if (!isSafeAssetFilename(filename)) return null;
  const assetsDir = noteAssetsDirFor(markdownPath);
  const candidate = path.join(assetsDir, filename);
  try {
    const safeDir = assertWithinRoot(config.libraryPath, assetsDir);
    const safePath = assertWithinRoot(safeDir, candidate);
    if (!fs.existsSync(safePath)) return null;
    return assertRealPathWithinRoot(config.libraryPath, safePath);
  } catch {
    return null;
  }
}

export function deleteNoteAssetsDir(markdownPath: string): void {
  const assetsDir = noteAssetsDirFor(markdownPath);
  if (!fs.existsSync(assetsDir)) return;
  const safeDir = assertRealPathWithinRoot(config.libraryPath, assetsDir);
  fs.rmSync(safeDir, { recursive: true, force: true });
}

export const NOTE_ASSET_CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};
