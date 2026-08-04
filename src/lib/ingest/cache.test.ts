import { describe, expect, it } from "vitest";
import { resolveCacheAsset, writeArticleCache } from "@/lib/ingest/cache";

describe("article cache", () => {
  it("rejects asset filenames that could escape the cache directory", () => {
    expect(() =>
      writeArticleCache({
        documentId: "document",
        cacheKey: "cache-key",
        html: "<p>Article</p>",
        assets: [
          {
            filename: "../outside.png",
            contentType: "image/png",
            data: Buffer.from("not-an-image"),
          },
        ],
      }),
    ).toThrow(/simple filename/i);
  });

  it("does not resolve unsafe asset request paths", () => {
    expect(resolveCacheAsset("document", "cache-key", "../outside.png")).toBeNull();
  });
});
