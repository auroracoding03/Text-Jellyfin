import type { DocumentRecord } from "@/lib/catalog/types";

export type FeedItem =
  | { kind: "document"; document: DocumentRecord }
  | { kind: "series"; series: string; chapters: DocumentRecord[] };

export function parseChapterNumber(title: string): number | null {
  const patterns = [
    /\b(?:chapter|ch\.?|part)\s*(\d+)\b/i,
    /^(\d{1,4})\s*[-.:)—–]\s*/,
    /^(\d{1,4})\s+/,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

export function resolveChapterNumber(
  title: string,
  explicit?: number | null,
): number | null {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return Math.floor(explicit);
  }
  return parseChapterNumber(title);
}

export function sortSeriesChapters(chapters: DocumentRecord[]): DocumentRecord[] {
  return [...chapters].sort((left, right) => {
    const leftChapter =
      left.chapter ?? parseChapterNumber(left.title) ?? Number.POSITIVE_INFINITY;
    const rightChapter =
      right.chapter ?? parseChapterNumber(right.title) ?? Number.POSITIVE_INFINITY;
    if (leftChapter !== rightChapter) return leftChapter - rightChapter;
    return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
  });
}

export function chapterDisplayNumber(document: DocumentRecord, index: number): number {
  return document.chapter ?? parseChapterNumber(document.title) ?? index + 1;
}

function activityTime(document: DocumentRecord): number {
  return Date.parse(document.indexedAt || document.updatedAt || document.createdAt) || 0;
}

export function buildFeedItems(documents: DocumentRecord[]): FeedItem[] {
  const seriesMap = new Map<string, DocumentRecord[]>();
  const standalone: DocumentRecord[] = [];

  for (const document of documents) {
    const series = document.series?.trim();
    if (series) {
      const chapters = seriesMap.get(series) || [];
      chapters.push(document);
      seriesMap.set(series, chapters);
      continue;
    }
    standalone.push(document);
  }

  const items: FeedItem[] = [];
  for (const [series, chapters] of Array.from(seriesMap.entries())) {
    items.push({ kind: "series", series, chapters: sortSeriesChapters(chapters) });
  }
  for (const document of standalone) {
    items.push({ kind: "document", document });
  }

  items.sort((left, right) => {
    const leftTime =
      left.kind === "series"
        ? Math.max(...left.chapters.map(activityTime))
        : activityTime(left.document);
    const rightTime =
      right.kind === "series"
        ? Math.max(...right.chapters.map(activityTime))
        : activityTime(right.document);
    return rightTime - leftTime;
  });

  return items;
}

export function getSeriesNeighbors(
  chapters: DocumentRecord[],
  currentId: string,
): { previous: DocumentRecord | null; next: DocumentRecord | null; index: number; total: number } {
  const sorted = sortSeriesChapters(chapters);
  const index = sorted.findIndex((chapter) => chapter.id === currentId);
  if (index < 0) {
    return { previous: null, next: null, index: -1, total: sorted.length };
  }
  return {
    previous: index > 0 ? sorted[index - 1] : null,
    next: index < sorted.length - 1 ? sorted[index + 1] : null,
    index,
    total: sorted.length,
  };
}
