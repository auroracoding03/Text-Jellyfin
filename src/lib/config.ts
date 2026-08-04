import path from "node:path";

function resolvePath(value: string | undefined, fallback: string): string {
  const raw = value?.trim() || fallback;
  return path.resolve(raw);
}

export const config = {
  libraryPath: resolvePath(
    process.env.LIBRARY_PATH,
    path.join(process.cwd(), "fixtures", "library"),
  ),
  dataPath: resolvePath(process.env.DATA_PATH, path.join(process.cwd(), "data")),
  get dbPath() {
    return path.join(this.dataPath, "catalog.db");
  },
  get cachePath() {
    return path.join(this.dataPath, "cache");
  },
  get uploadsPath() {
    return path.join(this.libraryPath, "uploads");
  },
  maxFileBytes: Number(process.env.MAX_FILE_BYTES || 40 * 1024 * 1024),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024),
  authUsername: process.env.AUTH_USERNAME?.trim() || "",
  authPassword: process.env.AUTH_PASSWORD || "",
  get authEnabled() {
    return Boolean(this.authUsername && this.authPassword);
  },
  adapterTimeoutMs: Number(process.env.ADAPTER_TIMEOUT_MS || 60_000),
  wordsPerMinute: 220,
};

export type AppConfig = typeof config;
