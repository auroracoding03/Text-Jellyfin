import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { StatusBadge } from "@/components/StatusBadge";
import { TagEditor } from "@/components/TagEditor";
import { canEditContent } from "@/lib/catalog/content-actions";
import { getDocumentById } from "@/lib/catalog/queries";
import { readArticleHtml } from "@/lib/ingest/cache";

export const dynamic = "force-dynamic";

export default async function WorkPage({
  params,
}: {
  params: { id: string };
}) {
  const document = getDocumentById(params.id);
  if (!document) notFound();

  const html = readArticleHtml(document.articleHtmlPath);
  const editableNote = canEditContent(document);

  return (
    <main className="reader-layout">
      <article className="article">
        <header className="article-header">
          <div className="meta-row" style={{ marginBottom: "0.75rem" }}>
            <span className="chip">{document.format.toUpperCase()}</span>
            {editableNote ? <span className="chip">Pasted note</span> : null}
            <StatusBadge status={document.status} />
            {document.wordCount > 0 ? (
              <span className="chip">{document.readingTimeMinutes} min read</span>
            ) : null}
          </div>
          <h1>{document.title}</h1>
          {document.summary ? <p>{document.summary}</p> : null}
        </header>

        {html ? (
          <div
            className="article-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="empty">
            No native article content is available yet. Use the original file
            fallback or wait for OCR support if this is a scanned PDF.
          </div>
        )}
      </article>

      <aside className="sidebar">
        <div className="panel">
          <h2>Metadata</h2>
          <dl>
            <div>
              <dt>Author</dt>
              <dd>{document.author || "—"}</dd>
            </div>
            <div>
              <dt>Series</dt>
              <dd>{document.series || "—"}</dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>{document.language || "—"}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{document.relativePath}</dd>
            </div>
            <div>
              <dt>Indexed</dt>
              <dd>{document.indexedAt || "—"}</dd>
            </div>
          </dl>
          <TagEditor id={document.id} initialTags={document.tags} />
        </div>

        {document.warnings.length ? (
          <div className="panel">
            <h2>Extraction notes</h2>
            <ul className="warning-list">
              {document.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="panel">
          <h2>Actions</h2>
          <div className="nav" style={{ flexDirection: "column", alignItems: "stretch" }}>
            {editableNote ? (
              <Link className="button button-primary" href={`/works/${document.id}/edit#note-text`}>
                Edit note text
              </Link>
            ) : null}
            <Link className="button" href={`/works/${document.id}/edit`}>
              Edit record
            </Link>
            <a className="button" href={`/api/works/${document.id}/original`}>
              Open original
            </a>
            <Link className="button" href="/">
              Back to library
            </Link>
            <DeleteDocumentButton id={document.id} title={document.title} />
          </div>
        </div>
      </aside>
    </main>
  );
}
