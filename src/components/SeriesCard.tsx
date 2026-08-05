import Link from "next/link";
import type { DocumentRecord } from "@/lib/catalog/types";
import { chapterDisplayNumber } from "@/lib/catalog/series";
import { StatusBadge } from "@/components/StatusBadge";

export function SeriesCard({
  series,
  chapters,
}: {
  series: string;
  chapters: DocumentRecord[];
}) {
  const first = chapters[0];
  const totalMinutes = chapters.reduce(
    (sum, chapter) => sum + (chapter.readingTimeMinutes || 0),
    0,
  );
  const teaser =
    first?.summary ||
    chapters.find((chapter) => chapter.summary)?.summary ||
    `${chapters.length} chapter${chapters.length === 1 ? "" : "s"}`;

  return (
    <div className="feed-item feed-series">
      <div className="feed-icon" aria-hidden="true">
        ≡
      </div>
      <div className="feed-copy">
        <p className="feed-kicker">Series</p>
        <h2>{series}</h2>
        <p>{teaser}</p>
        <div className="series-chapters" aria-label={`${series} chapters`}>
          {chapters.map((chapter, index) => (
            <Link
              key={chapter.id}
              href={`/works/${chapter.id}`}
              className="series-chapter"
              title={chapter.title}
            >
              {chapterDisplayNumber(chapter, index)}
            </Link>
          ))}
        </div>
      </div>
      <div className="feed-meta">
        {first ? <StatusBadge status={first.status} /> : null}
        <span>
          {chapters.length} ch{chapters.length === 1 ? "" : "s"}
        </span>
        {totalMinutes > 0 ? <span>{totalMinutes} min</span> : null}
      </div>
    </div>
  );
}
