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
  it("reads and updates a pasted Markdown note, then re-indexes it", async () => {
    const { actions, queries, scanner } = await loadTestModules();
    const sourcePath = path.join(
      process.env.LIBRARY_PATH!,
      "uploads",
      "pasted",
      "note.md",
    );
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "# First draft\n\nOriginal body.");
    writeSidecar(sourcePath, { title: "First draft", origin: "paste" });
    await scanner.scanLibrary();

    const document = queries.getDocumentByPath("uploads/pasted/note.md");
    expect(document).toBeTruthy();
    expect(actions.canEditContent(document!)).toBe(true);
    expect(actions.readEditableSource(document!.id)).toContain("Original body.");

    await actions.updateDocumentContent(document!.id, "# Revised\n\nUpdated body.");

    expect(fs.readFileSync(sourcePath, "utf8")).toContain("Updated body.");
    expect(queries.getDocumentByPath("uploads/pasted/note.md")?.summary).toContain(
      "Revised",
    );
  });

  it("does not allow library Markdown files to be edited as notes", async () => {
    const { actions, queries, scanner } = await loadTestModules();
    const sourcePath = path.join(process.env.LIBRARY_PATH!, "library-note.md");
    fs.writeFileSync(sourcePath, "# Library note\n\nBody.");
    await scanner.scanLibrary();

    const document = queries.getDocumentByPath("library-note.md");
    expect(actions.canEditContent(document!)).toBe(false);
    await expect(
      actions.updateDocumentContent(document!.id, "replacement"),
    ).rejects.toThrow("Only pasted Markdown and plain-text notes");
  });

  it("does not allow binary source formats to be edited", async () => {
    const { actions, queries, scanner } = await loadTestModules();
    const sourcePath = path.join(process.env.LIBRARY_PATH!, "document.pdf");
    fs.writeFileSync(sourcePath, "%PDF-1.4");
    await scanner.scanLibrary();

    const document = queries.getDocumentByPath("document.pdf");
    await expect(actions.updateDocumentContent(document!.id, "replacement")).rejects.toThrow(
      "Only pasted Markdown and plain-text notes",
    );
  });
});
