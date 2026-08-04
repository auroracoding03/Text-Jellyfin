import type { DocumentFormat, ExtractionStatus } from "@/lib/catalog/types";

export function SearchFilters({
  q,
  tag,
  format,
  status,
  tags,
}: {
  q: string;
  tag: string;
  format: string;
  status: string;
  tags: string[];
}) {
  return (
    <form className="filters" method="get">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Search titles, tags, and text"
        aria-label="Search"
      />
      <select name="tag" defaultValue={tag} aria-label="Tag">
        <option value="">All tags</option>
        {tags.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <select name="format" defaultValue={format} aria-label="Format">
        <option value="">All formats</option>
        {(["md", "txt", "docx", "pdf"] as DocumentFormat[]).map((value) => (
          <option key={value} value={value}>
            {value.toUpperCase()}
          </option>
        ))}
      </select>
      <select name="status" defaultValue={status} aria-label="Status">
        <option value="">All statuses</option>
        {(
          [
            "ready",
            "warning",
            "needs_ocr",
            "failed",
            "unsupported",
          ] as ExtractionStatus[]
        ).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <button className="button button-primary" type="submit">
        Filter
      </button>
    </form>
  );
}
