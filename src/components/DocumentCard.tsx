import Link from "next/link";
import { documentCoverSrc } from "@/lib/catalog/cover-url";
import type { DocumentRecord } from "@/lib/catalog/types";
import { StatusBadge } from "@/components/StatusBadge";

const FORMAT_ICONS: Record<DocumentRecord["format"], string> = {
  md: "✎",
  txt: "¶",
  docx: "▤",
  pdf: "▧",
  unknown: "?",
};

function FeedCover({ document }: { document: DocumentRecord }) {
  if (!document.hasCover) {
    return (
      <div className="feed-icon" aria-hidden="true">
        {FORMAT_ICONS[document.format]}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="feed-cover"
      src={documentCoverSrc(document)}
      alt=""
      loading="lazy"
    />
  );
}

export function DocumentCard({ document }: { document: DocumentRecord }) {
  return (
    <Link href={`/works/${document.id}`} className="feed-item">
      <FeedCover document={document} />
      <div className="feed-copy">
        <h2>{document.title}</h2>
        <p>{document.summary || "No teaser yet."}</p>
      </div>
      <div className="feed-meta">
        <StatusBadge status={document.status} />
        {document.wordCount > 0 ? <span>{document.readingTimeMinutes} min</span> : null}
      </div>
    </Link>
  );
}
