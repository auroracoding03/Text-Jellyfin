import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalLibraryPath = process.env.LIBRARY_PATH;
const originalDataPath = process.env.DATA_PATH;
const originalUploadLimit = process.env.MAX_UPLOAD_BYTES;
let tempDir: string | undefined;
let resetDbConnection: (() => void) | undefined;

async function loadUploadService() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-upload-"));
  process.env.LIBRARY_PATH = path.join(tempDir, "library");
  process.env.DATA_PATH = path.join(tempDir, "data");
  process.env.MAX_UPLOAD_BYTES = "64";
  fs.mkdirSync(process.env.LIBRARY_PATH, { recursive: true });

  vi.resetModules();
  const db = await import("@/lib/catalog/db");
  resetDbConnection = db.resetDbConnection;
  return import("@/lib/uploads/service");
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
  if (originalUploadLimit === undefined) delete process.env.MAX_UPLOAD_BYTES;
  else process.env.MAX_UPLOAD_BYTES = originalUploadLimit;
  vi.resetModules();
});

describe.sequential("upload service", () => {
  it("saves pasted text under uploads and indexes it", async () => {
    const { uploadText } = await loadUploadService();

    const result = await uploadText({
      title: "Phone note",
      format: "md",
      text: "# A note\n\nSent from my phone.",
      summary: "A short phone teaser.",
      tags: ["Phone", "inbox"],
    });

    expect(result.relativePath).toBe("uploads/pasted/Phone note.md");
    expect(result.documentId).toBeTruthy();
    expect(
      fs.readFileSync(path.join(process.env.LIBRARY_PATH!, result.relativePath), "utf8"),
    ).toContain("Sent from my phone.");
    const sidecar = fs.readFileSync(
      path.join(process.env.LIBRARY_PATH!, `${result.relativePath}.meta.yaml`),
      "utf8",
    );
    expect(sidecar).toContain("A short phone teaser.");
    expect(sidecar).toContain("phone");
    expect(sidecar).toContain("origin: paste");
  });

  it("rejects unsupported files and oversized uploads", async () => {
    const { UploadError, uploadFile, uploadText } = await loadUploadService();

    await expect(
      uploadFile({ filename: "archive.pdf", content: Buffer.from("not a PDF") }),
    ).rejects.toBeInstanceOf(UploadError);
    await expect(
      uploadText({ title: "Too large", format: "txt", text: "x".repeat(65) }),
    ).rejects.toMatchObject({ status: 413 });
  });
});
