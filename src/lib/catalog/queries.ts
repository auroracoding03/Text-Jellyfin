import type Database from "better-sqlite3";
import { getDb } from "@/lib/catalog/db";
import type {
  DocumentFilters,
  DocumentFormat,
  DocumentRecord,
  ExtractionStatus,
  LibraryStats,
  ScanRunSummary,
} from "@/lib/catalog/types";

type DocumentRow = {
  id: string;
  relative_path: string;
  format: DocumentFormat;
  title: string;
  summary: string;
  author: string | null;
  series: string | null;
  language: string | null;
  file_size: number;
  mtime_ms: number;
  content_hash: string;
  sidecar_hash: string | null;
  cache_key: string | null;
  article_html_path: string | null;
  plain_text: string;
  word_count: number;
  reading_time_minutes: number;
  adapter_name: string | null;
  adapter_version: string | null;
  status: ExtractionStatus;
  warnings_json: string;
  indexed_at: string | null;
  created_at: string;
  updated_at: string;
  absent: number;
};

function mapDocument(row: DocumentRow, tags: string[]): DocumentRecord {
  return {
    id: row.id,
    relativePath: row.relative_path,
    format: row.format,
    title: row.title,
    summary: row.summary,
    author: row.author,
    series: row.series,
    language: row.language,
    tags,
    fileSize: row.file_size,
    mtimeMs: row.mtime_ms,
    contentHash: row.content_hash,
    sidecarHash: row.sidecar_hash,
    cacheKey: row.cache_key,
    articleHtmlPath: row.article_html_path,
    plainText: row.plain_text,
    wordCount: row.word_count,
    readingTimeMinutes: row.reading_time_minutes,
    adapterName: row.adapter_name,
    adapterVersion: row.adapter_version,
    status: row.status,
    warnings: JSON.parse(row.warnings_json || "[]") as string[],
    indexedAt: row.indexed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    absent: Boolean(row.absent),
  };
}

function getTags(db: Database.Database, documentId: string): string[] {
  return db
    .prepare("SELECT tag FROM document_tags WHERE document_id = ? ORDER BY tag")
    .all(documentId)
    .map((row) => (row as { tag: string }).tag);
}

function attachTags(db: Database.Database, rows: DocumentRow[]): DocumentRecord[] {
  if (!rows.length) return [];

  const documentIds = rows.map((row) => row.id);
  const placeholders = documentIds.map(() => "?").join(", ");
  const tagsByDocument = new Map<string, string[]>();
  const tagRows = db
    .prepare(
      `SELECT document_id, tag
       FROM document_tags
       WHERE document_id IN (${placeholders})
       ORDER BY document_id, tag`,
    )
    .all(...documentIds) as Array<{ document_id: string; tag: string }>;

  for (const tagRow of tagRows) {
    const tags = tagsByDocument.get(tagRow.document_id) || [];
    tags.push(tagRow.tag);
    tagsByDocument.set(tagRow.document_id, tags);
  }

  return rows.map((row) => mapDocument(row, tagsByDocument.get(row.id) || []));
}

export function ensureFtsSchema(db: Database.Database = getDb()): void {
  const columns = db.prepare("PRAGMA table_info(documents_fts)").all() as Array<{
    name: string;
  }>;
  const hasDocumentId = columns.some((col) => col.name === "document_id");

  if (!columns.length || !hasDocumentId) {
    db.exec("DROP TABLE IF EXISTS documents_fts");
    db.exec(`
      CREATE VIRTUAL TABLE documents_fts USING fts5(
        document_id UNINDEXED,
        title,
        summary,
        author,
        tags,
        body,
        tokenize='porter'
      );
    `);
  }
}

function sanitizeFtsQuery(input: string): string {
  const tokens = input
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/["']/g, ""))
    .filter(Boolean)
    .map((token) => `"${token}"*`);
  return tokens.join(" AND ") || '""';
}

export function listDocuments(filters: DocumentFilters = {}): DocumentRecord[] {
  const db = getDb();
  ensureFtsSchema(db);

  const where: string[] = ["d.absent = 0"];
  const params: unknown[] = [];

  if (filters.format) {
    where.push("d.format = ?");
    params.push(filters.format);
  }
  if (filters.status) {
    where.push("d.status = ?");
    params.push(filters.status);
  }
  if (filters.tag) {
    where.push(
      "EXISTS (SELECT 1 FROM document_tags t WHERE t.document_id = d.id AND t.tag = ?)",
    );
    params.push(filters.tag);
  }

  if (filters.q?.trim()) {
    const sql = `
      SELECT d.*
      FROM documents_fts f
      JOIN documents d ON d.id = f.document_id
      WHERE ${where.join(" AND ")}
        AND documents_fts MATCH ?
      ORDER BY rank, d.title COLLATE NOCASE
    `;
    params.push(sanitizeFtsQuery(filters.q));
    return attachTags(db, db.prepare(sql).all(...params) as DocumentRow[]);
  }

  const sql = `
    SELECT d.*
    FROM documents d
    WHERE ${where.join(" AND ")}
    ORDER BY d.indexed_at DESC, d.title COLLATE NOCASE
  `;
  return attachTags(db, db.prepare(sql).all(...params) as DocumentRow[]);
}

export function getDocumentById(id: string): DocumentRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM documents WHERE id = ? AND absent = 0")
    .get(id) as DocumentRow | undefined;
  if (!row) return null;
  return mapDocument(row, getTags(db, row.id));
}

export function getDocumentByPath(relativePath: string): DocumentRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM documents WHERE relative_path = ?")
    .get(relativePath) as DocumentRow | undefined;
  if (!row) return null;
  return mapDocument(row, getTags(db, row.id));
}

export function deleteDocumentRecord(id: string): boolean {
  const db = getDb();
  ensureFtsSchema(db);
  const existing = db
    .prepare("SELECT id FROM documents WHERE id = ?")
    .get(id) as { id: string } | undefined;
  if (!existing) return false;

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM document_tags WHERE document_id = ?").run(id);
    db.prepare("DELETE FROM documents_fts WHERE document_id = ?").run(id);
    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
  });
  tx();
  return true;
}

export type UpsertDocumentInput = Omit<
  DocumentRecord,
  "createdAt" | "updatedAt" | "tags"
> & {
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
};

export function upsertDocument(input: UpsertDocumentInput): "added" | "updated" {
  const db = getDb();
  ensureFtsSchema(db);
  const now = new Date().toISOString();
  const createdAt = input.createdAt || now;
  const updatedAt = input.updatedAt || now;

  const existing = db
    .prepare("SELECT id FROM documents WHERE id = ? OR relative_path = ?")
    .get(input.id, input.relativePath) as { id: string } | undefined;

  const tx = db.transaction(() => {
    if (existing) {
      db.prepare(
        `UPDATE documents SET
          relative_path = ?, format = ?, title = ?, summary = ?, author = ?, series = ?,
          language = ?, file_size = ?, mtime_ms = ?, content_hash = ?, sidecar_hash = ?,
          cache_key = ?, article_html_path = ?, plain_text = ?, word_count = ?,
          reading_time_minutes = ?, adapter_name = ?, adapter_version = ?, status = ?,
          warnings_json = ?, indexed_at = ?, updated_at = ?, absent = ?
         WHERE id = ?`,
      ).run(
        input.relativePath,
        input.format,
        input.title,
        input.summary,
        input.author,
        input.series,
        input.language,
        input.fileSize,
        input.mtimeMs,
        input.contentHash,
        input.sidecarHash,
        input.cacheKey,
        input.articleHtmlPath,
        input.plainText,
        input.wordCount,
        input.readingTimeMinutes,
        input.adapterName,
        input.adapterVersion,
        input.status,
        JSON.stringify(input.warnings),
        input.indexedAt,
        updatedAt,
        input.absent ? 1 : 0,
        existing.id,
      );
      db.prepare("DELETE FROM document_tags WHERE document_id = ?").run(existing.id);
      db.prepare("DELETE FROM documents_fts WHERE document_id = ?").run(existing.id);
    } else {
      db.prepare(
        `INSERT INTO documents (
          id, relative_path, format, title, summary, author, series, language,
          file_size, mtime_ms, content_hash, sidecar_hash, cache_key, article_html_path,
          plain_text, word_count, reading_time_minutes, adapter_name, adapter_version,
          status, warnings_json, indexed_at, created_at, updated_at, absent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        input.id,
        input.relativePath,
        input.format,
        input.title,
        input.summary,
        input.author,
        input.series,
        input.language,
        input.fileSize,
        input.mtimeMs,
        input.contentHash,
        input.sidecarHash,
        input.cacheKey,
        input.articleHtmlPath,
        input.plainText,
        input.wordCount,
        input.readingTimeMinutes,
        input.adapterName,
        input.adapterVersion,
        input.status,
        JSON.stringify(input.warnings),
        input.indexedAt,
        createdAt,
        updatedAt,
        input.absent ? 1 : 0,
      );
    }

    const id = existing?.id || input.id;
    const insertTag = db.prepare(
      "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?, ?)",
    );
    for (const tag of input.tags) {
      insertTag.run(id, tag);
    }

    db.prepare(
      `INSERT INTO documents_fts (document_id, title, summary, author, tags, body)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.title,
      input.summary,
      input.author || "",
      input.tags.join(" "),
      input.plainText,
    );
  });

  tx();
  return existing ? "updated" : "added";
}

export function markMissingDocuments(presentPaths: Set<string>): number {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, relative_path FROM documents WHERE absent = 0")
    .all() as Array<{ id: string; relative_path: string }>;

  let removed = 0;
  const mark = db.prepare(
    "UPDATE documents SET absent = 1, updated_at = ?, status = 'absent' WHERE id = ?",
  );
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    for (const row of rows) {
      if (!presentPaths.has(row.relative_path)) {
        mark.run(now, row.id);
        removed += 1;
      }
    }
  });
  tx();
  return removed;
}

export function listTags(): string[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT DISTINCT t.tag
       FROM document_tags t
       JOIN documents d ON d.id = t.document_id
       WHERE d.absent = 0
       ORDER BY t.tag COLLATE NOCASE`,
    )
    .all()
    .map((row) => (row as { tag: string }).tag);
}

export function getLibraryStats(): LibraryStats {
  const db = getDb();
  const total = (
    db.prepare("SELECT COUNT(*) AS c FROM documents WHERE absent = 0").get() as {
      c: number;
    }
  ).c;

  const byStatus = db
    .prepare(
      "SELECT status, COUNT(*) AS c FROM documents WHERE absent = 0 GROUP BY status",
    )
    .all() as Array<{ status: string; c: number }>;

  const byFormatRows = db
    .prepare(
      "SELECT format, COUNT(*) AS c FROM documents WHERE absent = 0 GROUP BY format",
    )
    .all() as Array<{ format: string; c: number }>;

  const statusMap = Object.fromEntries(byStatus.map((row) => [row.status, row.c]));
  const byFormat = Object.fromEntries(byFormatRows.map((row) => [row.format, row.c]));

  return {
    total,
    ready: statusMap.ready || 0,
    warning: statusMap.warning || 0,
    needsOcr: statusMap.needs_ocr || 0,
    failed: statusMap.failed || 0,
    unsupported: statusMap.unsupported || 0,
    byFormat,
  };
}

export function startScanRun(): number {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO scan_runs (started_at) VALUES (?)")
    .run(new Date().toISOString());
  return Number(result.lastInsertRowid);
}

export function finishScanRun(
  id: number,
  summary: Omit<ScanRunSummary, "id" | "startedAt" | "finishedAt">,
): void {
  const db = getDb();
  db.prepare(
    `UPDATE scan_runs
     SET finished_at = ?, scanned = ?, added = ?, updated = ?, skipped = ?, failed = ?, removed = ?, message = ?
     WHERE id = ?`,
  ).run(
    new Date().toISOString(),
    summary.scanned,
    summary.added,
    summary.updated,
    summary.skipped,
    summary.failed,
    summary.removed,
    summary.message,
    id,
  );
}

export function getLatestScanRun(): ScanRunSummary | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM scan_runs ORDER BY id DESC LIMIT 1")
    .get() as
    | {
        id: number;
        started_at: string;
        finished_at: string | null;
        scanned: number;
        added: number;
        updated: number;
        skipped: number;
        failed: number;
        removed: number;
        message: string | null;
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    scanned: row.scanned,
    added: row.added,
    updated: row.updated,
    skipped: row.skipped,
    failed: row.failed,
    removed: row.removed,
    message: row.message,
  };
}
