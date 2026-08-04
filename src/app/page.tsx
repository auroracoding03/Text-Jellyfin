import { DocumentCard } from "@/components/DocumentCard";
import { SearchFilters } from "@/components/SearchFilters";
import { getLibraryStats, listDocuments, listTags } from "@/lib/catalog/queries";
import type { DocumentFormat, ExtractionStatus } from "@/lib/catalog/types";
import { scanLibrary } from "@/lib/ingest/scanner";
import { dbExists } from "@/lib/catalog/db";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  tag?: string;
  format?: string;
  status?: string;
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (!dbExists()) {
    await scanLibrary();
  }

  const q = searchParams.q || "";
  const tag = searchParams.tag || "";
  const format = (searchParams.format || "") as DocumentFormat | "";
  const status = (searchParams.status || "") as ExtractionStatus | "";

  const documents = listDocuments({ q, tag, format, status });
  const tags = listTags();
  const stats = getLibraryStats();

  return (
    <main>
      <section className="hero">
        <h1>Your text library, readable as articles.</h1>
        <p>
          Browse Markdown, plain text, Word, and PDF files from a local folder.
          Each document is indexed into a native reading view with searchable
          metadata and extraction status.
        </p>
      </section>

      <div className="stats">
        <span className="chip">{stats.total} documents</span>
        <span className="chip">{stats.ready} ready</span>
        <span className="chip">{stats.warning} warnings</span>
        <span className="chip">{stats.needsOcr} need OCR</span>
      </div>

      <SearchFilters q={q} tag={tag} format={format} status={status} tags={tags} />

      {documents.length === 0 ? (
        <div className="empty">
          No documents matched. Add files under your library folder and rescan
          from Settings.
        </div>
      ) : (
        <div className="library-feed">
          {documents.map((document) => (
            <DocumentCard key={document.id} document={document} />
          ))}
        </div>
      )}
    </main>
  );
}
