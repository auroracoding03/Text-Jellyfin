import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalLibraryPath = process.env.LIBRARY_PATH;
const originalDataPath = process.env.DATA_PATH;
let tempDir: string | undefined;
let resetDbConnection: (() => void) | undefined;

async function loadTestModules() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-metadata-"));
  process.env.LIBRARY_PATH = path.join(tempDir, "library");
  process.env.DATA_PATH = path.join(tempDir, "data");
  fs.mkdirSync(process.env.LIBRARY_PATH, { recursive: true });
  fs.writeFileSync(
    path.join(process.env.LIBRARY_PATH, "note.md"),
    "# Body\n\nOriginal text.",
  );
  fs.writeFileSync(
    path.join(process.env.LIBRARY_PATH, "note.md.meta.yaml"),
    "title: Existing title\nsummary: Existing teaser\nauthor: Existing author\ntags:\n  - old\n",
  );

  vi.resetModules();
  const db = await import("@/lib/catalog/db");
  resetDbConnection = db.resetDbConnection;
  return {
    actions: await import("@/lib/catalog/metadata-actions"),
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

describe.sequential("metadata actions", () => {
  it("updates inline tags without erasing the rest of the record metadata", async () => {
    const { actions, queries, scanner } = await loadTestModules();
    await scanner.scanLibrary();
    const document = queries.getDocumentByPath("note.md");

    await actions.updateDocumentMetadata(document!.id, { tags: ["reading", "personal"] });

    const updated = queries.getDocumentByPath("note.md");
    expect(updated).toMatchObject({
      title: "Existing title",
      summary: "Existing teaser",
      author: "Existing author",
      tags: ["personal", "reading"],
    });
  });
});
