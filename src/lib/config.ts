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
  maxFileBytes: Number(process.env.MAX_FILE_BYTES || 40 * 1024 * 1024),
  adapterTimeoutMs: Number(process.env.ADAPTER_TIMEOUT_MS || 60_000),
  wordsPerMinute: 220,
};

export type AppConfig = typeof config;
