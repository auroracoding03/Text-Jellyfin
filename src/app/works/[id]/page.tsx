import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { StatusBadge } from "@/components/StatusBadge";
import { TagEditor } from "@/components/TagEditor";
import { canEditContent } from "@/lib/catalog/content-actions";
import { getDocumentById, listDocumentsBySeries } from "@/lib/catalog/queries";
import {
  chapterDisplayNumber,
  getSeriesNeighbors,
  sortSeriesChapters,
} from "@/lib/catalog/series";
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
  const seriesChapters = document.series
    ? sortSeriesChapters(listDocumentsBySeries(document.series))
    : [];
  const neighbors =
    seriesChapters.length > 1
      ? getSeriesNeighbors(seriesChapters, document.id)
      : null;
  const chapterIndex =
    neighbors && neighbors.index >= 0
      ? neighbors.index
      : seriesChapters.findIndex((chapter) => chapter.id === document.id);
  const chapterLabel =
    chapterIndex >= 0
      ? chapterDisplayNumber(seriesChapters[chapterIndex], chapterIndex)
      : document.chapter;

  return (
    <main className="reader-layout">
      <article className="article">
        <header className="article-header">
          <div className="meta-row" style={{ marginBottom: "0.75rem" }}>
            <span className="chip">{document.format.toUpperCase()}</span>
            {editableNote ? <span className="chip">Pasted note</span> : null}
            {document.series ? (
              <span className="chip">
                {document.series}
                {chapterLabel ? ` · ${chapterLabel}` : ""}
              </span>
            ) : null}
            <StatusBadge status={document.status} />
            {document.wordCount > 0 ? (
              <span className="chip">{document.readingTimeMinutes} min read</span>
            ) : null}
          </div>
          <h1>{document.title}</h1>
          {document.summary ? <p>{document.summary}</p> : null}
        </header>

        {neighbors ? (
          <nav className="series-nav" aria-label="Series chapters">
            {neighbors.previous ? (
              <Link
                className="button"
                href={`/works/${neighbors.previous.id}`}
                rel="prev"
              >
                ← Ch {chapterDisplayNumber(neighbors.previous, neighbors.index - 1)}
              </Link>
            ) : (
              <span className="button button-disabled" aria-disabled="true">
                ← Previous
              </span>
            )}
            <span className="series-nav-position">
              {neighbors.index + 1} of {neighbors.total}
            </span>
            {neighbors.next ? (
              <Link
                className="button"
                href={`/works/${neighbors.next.id}`}
                rel="next"
              >
                Ch {chapterDisplayNumber(neighbors.next, neighbors.index + 1)} →
              </Link>
            ) : (
              <span className="button button-disabled" aria-disabled="true">
                Next →
              </span>
            )}
          </nav>
        ) : null}

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

        {neighbors ? (
          <nav className="series-nav series-nav-footer" aria-label="Continue series">
            {neighbors.previous ? (
              <Link className="button" href={`/works/${neighbors.previous.id}`} rel="prev">
                ← {neighbors.previous.title}
              </Link>
            ) : (
              <span />
            )}
            {neighbors.next ? (
              <Link
                className="button button-primary"
                href={`/works/${neighbors.next.id}`}
                rel="next"
              >
                {neighbors.next.title} →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
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
              <dt>Chapter</dt>
              <dd>{chapterLabel || "—"}</dd>
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
          {seriesChapters.length > 1 ? (
            <div className="series-sidebar">
              <h3>In this series</h3>
              <ol className="series-toc">
                {seriesChapters.map((chapter, index) => (
                  <li key={chapter.id}>
                    {chapter.id === document.id ? (
                      <span aria-current="page">
                        {chapterDisplayNumber(chapter, index)}. {chapter.title}
                      </span>
                    ) : (
                      <Link href={`/works/${chapter.id}`}>
                        {chapterDisplayNumber(chapter, index)}. {chapter.title}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
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
