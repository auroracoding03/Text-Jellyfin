import { describe, expect, it } from "vitest";
import { documentCoverSrc } from "@/lib/catalog/cover-url";

describe("documentCoverSrc", () => {
  it("cache-busts with sidecar hash when present", () => {
    expect(
      documentCoverSrc({
        id: "abc",
        updatedAt: "2026-08-31T00:00:00.000Z",
        sidecarHash: "ffffffffffffffff",
      }),
    ).toBe("/api/works/abc/cover?v=ffffffffffff");
  });

  it("falls back to updatedAt", () => {
    expect(
      documentCoverSrc({
        id: "abc",
        updatedAt: "2026-08-31T00:00:00.000Z",
      }),
    ).toBe("/api/works/abc/cover?v=2026-08-31T00%3A00%3A00.000Z");
  });
});
