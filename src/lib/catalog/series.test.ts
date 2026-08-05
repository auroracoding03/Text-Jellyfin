import { describe, expect, it } from "vitest";
import {
  buildFeedItems,
  chapterDisplayNumber,
  getSeriesNeighbors,
  parseChapterNumber,
  sortSeriesChapters,
} from "@/lib/catalog/series";
import type { DocumentRecord } from "@/lib/catalog/types";

function doc(partial: Partial<DocumentRecord> & Pick<DocumentRecord, "id" | "title">): DocumentRecord {
  return {
    relativePath: `${partial.id}.md`,
    format: "md",
    summary: "",
    author: null,
    series: null,
    chapter: null,
    language: null,
    tags: [],
    fileSize: 1,
    mtimeMs: 1,
    contentHash: "hash",
    sidecarHash: null,
    cacheKey: null,
    articleHtmlPath: null,
    plainText: "",
    wordCount: 0,
    readingTimeMinutes: 0,
    adapterName: "markdown",
    adapterVersion: "1",
    status: "ready",
    warnings: [],
    indexedAt: "2026-01-02T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    absent: false,
    ...partial,
  };
}

describe("series helpers", () => {
  it("parses chapter numbers from titles", () => {
    expect(parseChapterNumber("Chapter 3 — Crossing")).toBe(3);
    expect(parseChapterNumber("Ch. 12 Departure")).toBe(12);
    expect(parseChapterNumber("02. The Bridge")).toBe(2);
    expect(parseChapterNumber("Untitled")).toBeNull();
  });

  it("sorts chapters and builds neighbors", () => {
    const chapters = sortSeriesChapters([
      doc({ id: "b", title: "Chapter 2", series: "Road", chapter: 2 }),
      doc({ id: "c", title: "Chapter 3", series: "Road", chapter: 3 }),
      doc({ id: "a", title: "Chapter 1", series: "Road", chapter: 1 }),
    ]);
    expect(chapters.map((chapter) => chapter.id)).toEqual(["a", "b", "c"]);
    expect(chapterDisplayNumber(chapters[0], 0)).toBe(1);

    const neighbors = getSeriesNeighbors(chapters, "b");
    expect(neighbors.previous?.id).toBe("a");
    expect(neighbors.next?.id).toBe("c");
    expect(neighbors.index).toBe(1);
    expect(neighbors.total).toBe(3);
  });

  it("groups series into one feed block", () => {
    const items = buildFeedItems([
      doc({
        id: "solo",
        title: "Alone",
        indexedAt: "2026-01-03T00:00:00.000Z",
      }),
      doc({
        id: "ch2",
        title: "Chapter 2",
        series: "The Long Road",
        chapter: 2,
        indexedAt: "2026-01-04T00:00:00.000Z",
      }),
      doc({
        id: "ch1",
        title: "Chapter 1",
        series: "The Long Road",
        chapter: 1,
        indexedAt: "2026-01-01T00:00:00.000Z",
      }),
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: "series", series: "The Long Road" });
    if (items[0].kind === "series") {
      expect(items[0].chapters.map((chapter) => chapter.id)).toEqual(["ch1", "ch2"]);
    }
    expect(items[1]).toMatchObject({ kind: "document", document: { id: "solo" } });
  });
});
