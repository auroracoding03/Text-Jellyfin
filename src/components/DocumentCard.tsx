import Link from "next/link";
import type { DocumentRecord } from "@/lib/catalog/types";
import { StatusBadge } from "@/components/StatusBadge";

const FORMAT_ICONS: Record<DocumentRecord["format"], string> = {
  md: "✎",
  txt: "¶",
  docx: "▤",
  pdf: "▧",
  unknown: "?",
};

export function DocumentCard({ document }: { document: DocumentRecord }) {
  return (
    <Link href={`/works/${document.id}`} className="feed-item">
      <div className="feed-icon" aria-hidden="true">
        {FORMAT_ICONS[document.format]}
      </div>
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
