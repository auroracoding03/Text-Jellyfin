import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalLibraryPath = process.env.LIBRARY_PATH;
const originalDataPath = process.env.DATA_PATH;
const originalImageBytes = process.env.MAX_NOTE_IMAGE_BYTES;
let tempDir: string | undefined;

function tinyJpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x01]);
}

async function loadCover() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-cover-"));
  process.env.LIBRARY_PATH = path.join(tempDir, "library");
  process.env.DATA_PATH = path.join(tempDir, "data");
  fs.mkdirSync(process.env.LIBRARY_PATH, { recursive: true });
  vi.resetModules();
  return import("@/lib/catalog/cover");
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
  vi.resetModules();
});

describe("document covers", () => {
  it("persists, replaces, and deletes sibling cover files", async () => {
    const { coverPathFor, persistCover, resolveCoverPath, deleteCoverFile, coverMtimeMs } =
      await loadCover();
    const sourcePath = path.join(process.env.LIBRARY_PATH!, "story.md");
    fs.writeFileSync(sourcePath, "# Story");

    persistCover(sourcePath, tinyJpeg());
    const coverPath = coverPathFor(sourcePath);
    expect(fs.existsSync(coverPath)).toBe(true);
    expect(resolveCoverPath(sourcePath)).toBeTruthy();
    expect(coverMtimeMs(sourcePath)).toBeGreaterThan(0);

    const replacement = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x02]);
    persistCover(sourcePath, replacement);
    expect(fs.readFileSync(coverPath)).toEqual(replacement);

    deleteCoverFile(sourcePath);
    expect(fs.existsSync(coverPath)).toBe(false);
    expect(resolveCoverPath(sourcePath)).toBeNull();
  });

  it("rejects oversize covers and svg payloads", async () => {
    process.env.MAX_NOTE_IMAGE_BYTES = "4";
    const { persistCover, CoverImageError } = await loadCover();
    const sourcePath = path.join(process.env.LIBRARY_PATH!, "story.md");
    fs.writeFileSync(sourcePath, "# Story");

    expect(() => persistCover(sourcePath, tinyJpeg())).toThrow(/smaller after compression/i);
    expect(() =>
      persistCover(
        sourcePath,
        Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
      ),
    ).toThrow(CoverImageError);
  });
});

describe.sequential("cover sidecar round-trip", () => {
  it("writes cover: true in the sidecar when a cover is saved", async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-cover-sidecar-"));
    process.env.LIBRARY_PATH = path.join(tempDir, "library");
    process.env.DATA_PATH = path.join(tempDir, "data");
    fs.mkdirSync(process.env.LIBRARY_PATH, { recursive: true });
    vi.resetModules();

    const sourcePath = path.join(process.env.LIBRARY_PATH!, "note.md");
    fs.writeFileSync(sourcePath, "# Note");
    const { persistCover } = await import("@/lib/catalog/cover");
    const { readSidecar, writeSidecar } = await import("@/lib/ingest/metadata");

    persistCover(sourcePath, tinyJpeg());
    writeSidecar(sourcePath, { title: "Note" }, { cover: true });

    const sidecar = fs.readFileSync(`${sourcePath}.meta.yaml`, "utf8");
    expect(sidecar).toContain("cover: true");

    const scanned = readSidecar(sourcePath);
    expect(scanned.hasCover).toBe(true);
    expect(scanned.metadata.title).toBe("Note");
  });
});
