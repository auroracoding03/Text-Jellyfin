import Database from "better-sqlite3";
import fs from "node:fs";
import { config } from "@/lib/config";
import { ensureDir } from "@/lib/security/paths";

declare global {
  // eslint-disable-next-line no-var
  var __textJellyfinDb: Database.Database | undefined;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  relative_path TEXT NOT NULL UNIQUE,
  format TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  author TEXT,
  series TEXT,
  chapter INTEGER,
  language TEXT,
  file_size INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  sidecar_hash TEXT,
  cache_key TEXT,
  article_html_path TEXT,
  plain_text TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  reading_time_minutes INTEGER NOT NULL DEFAULT 0,
  adapter_name TEXT,
  adapter_version TEXT,
  status TEXT NOT NULL,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  indexed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  absent INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (document_id, tag),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scan_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  scanned INTEGER NOT NULL DEFAULT 0,
  added INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  removed INTEGER NOT NULL DEFAULT 0,
  message TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  document_id UNINDEXED,
  title,
  summary,
  author,
  tags,
  body,
  tokenize='porter'
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_format ON documents(format);
CREATE INDEX IF NOT EXISTS idx_documents_absent ON documents(absent);
CREATE INDEX IF NOT EXISTS idx_documents_series ON documents(series);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag);
`;

function migrateDocumentsSchema(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(documents)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "chapter")) {
    db.exec("ALTER TABLE documents ADD COLUMN chapter INTEGER");
  }
  if (!columns.some((column) => column.name === "has_cover")) {
    db.exec("ALTER TABLE documents ADD COLUMN has_cover INTEGER NOT NULL DEFAULT 0");
  }
}

export function getDb(): Database.Database {
  if (globalThis.__textJellyfinDb) {
    return globalThis.__textJellyfinDb;
  }

  ensureDir(config.dataPath);
  ensureDir(config.cachePath);

  const db = new Database(config.dbPath);
  db.exec(SCHEMA);
  migrateDocumentsSchema(db);
  globalThis.__textJellyfinDb = db;
  return db;
}

export function resetDbConnection(): void {
  if (globalThis.__textJellyfinDb) {
    globalThis.__textJellyfinDb.close();
    globalThis.__textJellyfinDb = undefined;
  }
}

export function dbExists(): boolean {
  return fs.existsSync(config.dbPath);
}
