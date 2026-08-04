import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalLibraryPath = process.env.LIBRARY_PATH;
const originalDataPath = process.env.DATA_PATH;
let tempDir: string | undefined;
let resetDbConnection: (() => void) | undefined;

async function loadTestModules() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-content-"));
  process.env.LIBRARY_PATH = path.join(tempDir, "library");
  process.env.DATA_PATH = path.join(tempDir, "data");
  fs.mkdirSync(process.env.LIBRARY_PATH, { recursive: true });

  vi.resetModules();
  const db = await import("@/lib/catalog/db");
  resetDbConnection = db.resetDbConnection;
  return {
    actions: await import("@/lib/catalog/content-actions"),
    queries: await import("@/lib/catalog/queries"),
    scanner: await import("@/lib/ingest/scanner"),
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

describe.sequential("document content actions", () => {
  it("reads and updates a Markdown source, then re-indexes it", async () => {
    const { actions, queries, scanner } = await loadTestModules();
    const sourcePath = path.join(process.env.LIBRARY_PATH!, "note.md");
    fs.writeFileSync(sourcePath, "# First draft\n\nOriginal body.");
    await scanner.scanLibrary();

    const document = queries.getDocumentByPath("note.md");
    expect(document).toBeTruthy();
    expect(actions.readEditableSource(document!.id)).toContain("Original body.");

    await actions.updateDocumentContent(document!.id, "# Revised\n\nUpdated body.");

    expect(fs.readFileSync(sourcePath, "utf8")).toContain("Updated body.");
    expect(queries.getDocumentByPath("note.md")?.summary).toContain("Revised");
  });

  it("does not allow binary source formats to be edited", async () => {
    const { actions, queries, scanner } = await loadTestModules();
    const sourcePath = path.join(process.env.LIBRARY_PATH!, "document.pdf");
    fs.writeFileSync(sourcePath, "%PDF-1.4");
    await scanner.scanLibrary();

    const document = queries.getDocumentByPath("document.pdf");
    await expect(actions.updateDocumentContent(document!.id, "replacement")).rejects.toThrow(
      "Only Markdown and plain-text",
    );
  });
});
