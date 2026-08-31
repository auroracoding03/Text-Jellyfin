import { afterEach, describe, expect, it, vi } from "vitest";

const originalPayloadBytes = process.env.MAX_NOTE_PAYLOAD_BYTES;

afterEach(() => {
  if (originalPayloadBytes === undefined) delete process.env.MAX_NOTE_PAYLOAD_BYTES;
  else process.env.MAX_NOTE_PAYLOAD_BYTES = originalPayloadBytes;
  vi.resetModules();
});

describe("note payload limits", () => {
  it("rejects requests above the configured multipart ceiling", async () => {
    process.env.MAX_NOTE_PAYLOAD_BYTES = "1000";
    vi.resetModules();
    const { exceedsNotePayloadLimit, notePayloadLimitError } = await import(
      "@/lib/notes/payload-limits"
    );

    expect(exceedsNotePayloadLimit(64 * 1024)).toBe(false);
    expect(exceedsNotePayloadLimit(64 * 1024 + 1001)).toBe(true);
    expect(notePayloadLimitError()).toContain("1000");
  });
});

describe("content PUT payload guard", () => {
  it("returns 413 before parsing oversized multipart bodies", async () => {
    process.env.MAX_NOTE_PAYLOAD_BYTES = "100";
    vi.resetModules();

    vi.doMock("@/lib/catalog/content-actions", () => ({
      updateDocumentContent: vi.fn(),
      ContentEditError: class extends Error {
        status = 400;
      },
    }));

    const { PUT } = await import("@/app/api/works/[id]/content/route");
    const response = await PUT(
      new Request("http://localhost/api/works/abc/content", {
        method: "PUT",
        headers: {
          "content-type": "multipart/form-data",
          "content-length": String(64 * 1024 + 200),
        },
        body: "ignored",
      }),
      { params: { id: "abc" } },
    );

    expect(response.status).toBe(413);
    const payload = await response.json();
    expect(payload.error).toContain("100");
  });
});
