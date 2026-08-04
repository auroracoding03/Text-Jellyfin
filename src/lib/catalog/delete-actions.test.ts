import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeSidecar } from "@/lib/ingest/metadata";

const originalLibraryPath = process.env.LIBRARY_PATH;
const originalDataPath = process.env.DATA_PATH;
let tempDir: string | undefined;
let resetDbConnection: (() => void) | undefined;

async function loadTestModules() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-delete-doc-"));
  process.env.LIBRARY_PATH = path.join(tempDir, "library");
  process.env.DATA_PATH = path.join(tempDir, "data");
  fs.mkdirSync(process.env.LIBRARY_PATH, { recursive: true });

  vi.resetModules();
  const db = await import("@/lib/catalog/db");
  resetDbConnection = db.resetDbConnection;
  return {
    actions: await import("@/lib/catalog/delete-actions"),
    queries: await import("@/lib/catalog/queries"),
    scanner: await import("@/lib/ingest/scanner"),
    config: await import("@/lib/config"),
  };
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

describe.sequential("deleteDocument", () => {
  it("removes the source, sidecar, cache, and catalog row", async () => {
    const { actions, queries, scanner, config } = await loadTestModules();
    const sourcePath = path.join(
      process.env.LIBRARY_PATH!,
      "uploads",
      "pasted",
      "temp-note.md",
    );
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "# Temp\n\nDisposable.");
    writeSidecar(sourcePath, { title: "Temp", origin: "paste" });
    await scanner.scanLibrary();

    const document = queries.getDocumentByPath("uploads/pasted/temp-note.md");
    expect(document).toBeTruthy();

    const cacheDir = path.join(config.config.cachePath, document!.id);
    expect(fs.existsSync(cacheDir) || document!.articleHtmlPath).toBeTruthy();

    actions.deleteDocument(document!.id);

    expect(fs.existsSync(sourcePath)).toBe(false);
    expect(fs.existsSync(`${sourcePath}.meta.yaml`)).toBe(false);
    expect(fs.existsSync(cacheDir)).toBe(false);
    expect(queries.getDocumentById(document!.id)).toBeNull();
  });
});
