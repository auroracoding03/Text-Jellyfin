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

  it("removes the sibling .assets directory for illustrated notes", async () => {
    const { actions, queries, scanner } = await loadTestModules();
    const sourcePath = path.join(
      process.env.LIBRARY_PATH!,
      "uploads",
      "pasted",
      "illustrated.md",
    );
    const assetsDir = path.join(
      process.env.LIBRARY_PATH!,
      "uploads",
      "pasted",
      "illustrated.assets",
    );
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(sourcePath, "![scene](note-assets/photo.jpg)");
    fs.writeFileSync(
      path.join(assetsDir, "photo.jpg"),
      Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x01]),
    );
    writeSidecar(sourcePath, { title: "Illustrated", origin: "paste" });
    await scanner.scanLibrary();

    const document = queries.getDocumentByPath("uploads/pasted/illustrated.md");
    actions.deleteDocument(document!.id);

    expect(fs.existsSync(sourcePath)).toBe(false);
    expect(fs.existsSync(assetsDir)).toBe(false);
  });

  it("removes the sibling cover file when present", async () => {
    const { actions, queries, scanner } = await loadTestModules();
    const sourcePath = path.join(
      process.env.LIBRARY_PATH!,
      "uploads",
      "pasted",
      "covered.md",
    );
    const coverPath = path.join(
      process.env.LIBRARY_PATH!,
      "uploads",
      "pasted",
      "covered.cover.jpg",
    );
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "# Covered");
    fs.writeFileSync(coverPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x01]));
    writeSidecar(sourcePath, { title: "Covered", origin: "paste" }, { cover: true });
    await scanner.scanLibrary();

    const document = queries.getDocumentByPath("uploads/pasted/covered.md");
    actions.deleteDocument(document!.id);

    expect(fs.existsSync(sourcePath)).toBe(false);
    expect(fs.existsSync(coverPath)).toBe(false);
  });
});
