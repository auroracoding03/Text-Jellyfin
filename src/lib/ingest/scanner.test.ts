import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalLibraryPath = process.env.LIBRARY_PATH;
const originalDataPath = process.env.DATA_PATH;
let tempDir: string | undefined;
let resetDbConnection: (() => void) | undefined;

async function loadTestModules() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-scan-"));
  process.env.LIBRARY_PATH = path.join(tempDir, "library");
  process.env.DATA_PATH = path.join(tempDir, "data");
  fs.mkdirSync(process.env.LIBRARY_PATH, { recursive: true });

  vi.resetModules();
  const db = await import("@/lib/catalog/db");
  resetDbConnection = db.resetDbConnection;
  const scanner = await import("@/lib/ingest/scanner");
  const queries = await import("@/lib/catalog/queries");
  return { scanner, queries };
}

afterEach(() => {
  resetDbConnection?.();
  resetDbConnection = undefined;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;

  if (originalLibraryPath === undefined) delete process.env.LIBRARY_PATH;
  else process.env.LIBRARY_PATH = originalLibraryPath;
  if (originalDataPath === undefined) delete process.env.DATA_PATH;
  else process.env.DATA_PATH = originalDataPath;
  vi.resetModules();
});

describe.sequential("library scanner", () => {
  it("coalesces concurrent scans and skips unchanged documents without re-extraction", async () => {
    const { scanner, queries } = await loadTestModules();
    const sourcePath = path.join(process.env.LIBRARY_PATH!, "note.md");
    fs.writeFileSync(sourcePath, "# A note\n\nInitial text.");

    const [first, concurrent] = await Promise.all([
      scanner.scanLibrary(),
      scanner.scanLibrary(),
    ]);
    expect(first).toEqual(concurrent);
    expect(first.added).toBe(1);

    const unchanged = await scanner.scanLibrary();
    expect(unchanged.skipped).toBe(1);

    fs.writeFileSync(`${sourcePath}.meta.yaml`, "title: Updated title\n");
    const metadataChanged = await scanner.scanLibrary();
    expect(metadataChanged.updated).toBe(1);
    expect(queries.getDocumentByPath("note.md")?.title).toBe("Updated title");
  });

  it("ignores symlinked files in the configured library", async () => {
    const { scanner, queries } = await loadTestModules();
    const outside = path.join(tempDir!, "outside.md");
    fs.writeFileSync(outside, "# Outside");
    fs.symlinkSync(outside, path.join(process.env.LIBRARY_PATH!, "outside.md"));

    const result = await scanner.scanLibrary();
    expect(result.scanned).toBe(0);
    expect(queries.listDocuments()).toEqual([]);
  });
});
