import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalLibraryPath = process.env.LIBRARY_PATH;
const originalDataPath = process.env.DATA_PATH;
const originalImageBytes = process.env.MAX_NOTE_IMAGE_BYTES;
const originalImageCount = process.env.MAX_NOTE_IMAGES;
let tempDir: string | undefined;

function tinyJpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x01]);
}

async function loadAssets() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-assets-"));
  process.env.LIBRARY_PATH = path.join(tempDir, "library");
  process.env.DATA_PATH = path.join(tempDir, "data");
  fs.mkdirSync(process.env.LIBRARY_PATH, { recursive: true });
  vi.resetModules();
  return import("@/lib/notes/assets");
}

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
  if (originalLibraryPath === undefined) delete process.env.LIBRARY_PATH;
  else process.env.LIBRARY_PATH = originalLibraryPath;
  if (originalDataPath === undefined) delete process.env.DATA_PATH;
  else process.env.DATA_PATH = originalDataPath;
  if (originalImageBytes === undefined) delete process.env.MAX_NOTE_IMAGE_BYTES;
  else process.env.MAX_NOTE_IMAGE_BYTES = originalImageBytes;
  if (originalImageCount === undefined) delete process.env.MAX_NOTE_IMAGES;
  else process.env.MAX_NOTE_IMAGES = originalImageCount;
  vi.resetModules();
});

describe("note assets", () => {
  it("detects jpeg, png, and webp magic bytes and rejects svg", async () => {
    const { detectImageContentType } = await loadAssets();
    expect(detectImageContentType(tinyJpeg())).toBe("image/jpeg");
    expect(
      detectImageContentType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      ),
    ).toBe("image/png");
    const webp = Buffer.alloc(16);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    expect(detectImageContentType(webp)).toBe("image/webp");
    expect(detectImageContentType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
  });

  it("writes referenced images next to the note and prunes unused files", async () => {
    const { persistNoteAssets, noteAssetsDirFor } = await loadAssets();
    const notePath = path.join(process.env.LIBRARY_PATH!, "uploads", "pasted", "story.md");
    fs.mkdirSync(path.dirname(notePath), { recursive: true });
    fs.writeFileSync(notePath, "Hello ![keep](note-assets/keep.jpg) ![drop](note-assets/drop.jpg)");

    persistNoteAssets({
      markdownPath: notePath,
      markdown: fs.readFileSync(notePath, "utf8"),
      images: [
        { filename: "keep.jpg", data: tinyJpeg() },
        { filename: "drop.jpg", data: tinyJpeg() },
      ],
      prune: false,
    });

    const assetsDir = noteAssetsDirFor(notePath);
    expect(fs.existsSync(path.join(assetsDir, "keep.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(assetsDir, "drop.jpg"))).toBe(true);

    persistNoteAssets({
      markdownPath: notePath,
      markdown: "Hello ![keep](note-assets/keep.jpg)",
      images: [],
      prune: true,
    });

    expect(fs.existsSync(path.join(assetsDir, "keep.jpg"))).toBe(true);
    expect(fs.existsSync(path.join(assetsDir, "drop.jpg"))).toBe(false);
  });

  it("rejects oversize images, too many images, and traversal names", async () => {
    process.env.MAX_NOTE_IMAGE_BYTES = "4";
    process.env.MAX_NOTE_IMAGES = "1";
    const { persistNoteAssets, NoteAssetError } = await loadAssets();
    const notePath = path.join(process.env.LIBRARY_PATH!, "note.md");
    fs.writeFileSync(notePath, "x");

    expect(() =>
      persistNoteAssets({
        markdownPath: notePath,
        markdown: "![a](note-assets/too-big.jpg)",
        images: [{ filename: "too-big.jpg", data: tinyJpeg() }],
        prune: false,
      }),
    ).toThrow(/smaller after compression/i);

    expect(() =>
      persistNoteAssets({
        markdownPath: notePath,
        markdown: "![a](note-assets/one.jpg) ![b](note-assets/two.jpg)",
        images: [
          { filename: "one.jpg", data: tinyJpeg() },
          { filename: "two.jpg", data: tinyJpeg() },
        ],
        prune: false,
      }),
    ).toThrow(/at most/i);

    expect(() =>
      persistNoteAssets({
        markdownPath: notePath,
        markdown: "![a](note-assets/ok.jpg)",
        images: [{ filename: "../escape.jpg", data: tinyJpeg() }],
        prune: false,
      }),
    ).toThrow(NoteAssetError);
  });
});
