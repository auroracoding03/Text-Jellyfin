import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalLibraryPath = process.env.LIBRARY_PATH;
const originalDataPath = process.env.DATA_PATH;
let tempDir: string | undefined;
let resetDbConnection: (() => void) | undefined;

async function loadDeleteData() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-delete-"));
  process.env.LIBRARY_PATH = path.join(tempDir, "library");
  process.env.DATA_PATH = path.join(tempDir, "data");
  fs.mkdirSync(process.env.LIBRARY_PATH, { recursive: true });
  fs.mkdirSync(path.join(process.env.DATA_PATH, "cache"), { recursive: true });

  vi.resetModules();
  const db = await import("@/lib/catalog/db");
  resetDbConnection = db.resetDbConnection;
  return import("@/lib/server/delete-data");
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

describe.sequential("wipeServerData", () => {
  it("removes catalog and cache but keeps library uploads", async () => {
    const { wipeServerData } = await loadDeleteData();
    const db = await import("@/lib/catalog/db");
    const { config } = await import("@/lib/config");

    db.getDb().exec("SELECT 1");
    expect(fs.existsSync(config.dbPath)).toBe(true);

    const upload = path.join(config.libraryPath, "uploads", "note.md");
    fs.mkdirSync(path.dirname(upload), { recursive: true });
    fs.writeFileSync(upload, "# keep me");
    fs.writeFileSync(path.join(config.cachePath, "article.html"), "<p>cached</p>");

    wipeServerData();

    expect(fs.existsSync(config.dbPath)).toBe(false);
    expect(fs.existsSync(path.join(config.cachePath, "article.html"))).toBe(false);
    expect(fs.readFileSync(upload, "utf8")).toBe("# keep me");
  });
});
