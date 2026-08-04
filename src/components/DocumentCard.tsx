import Link from "next/link";
import type { DocumentRecord } from "@/lib/catalog/types";
import { StatusBadge } from "@/components/StatusBadge";

export function DocumentCard({ document }: { document: DocumentRecord }) {
  return (
    <Link href={`/works/${document.id}`} className="card">
      <div className="meta-row">
        <span className="chip">{document.format.toUpperCase()}</span>
        <StatusBadge status={document.status} />
      </div>
      <h2>{document.title}</h2>
      <p>{document.summary || "No summary yet."}</p>
      <div className="tag-row">
        {document.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="chip">
            {tag}
          </span>
        ))}
        {document.wordCount > 0 ? (
          <span className="chip">{document.readingTimeMinutes} min</span>
        ) : null}
      </div>
    </Link>
  );
}
