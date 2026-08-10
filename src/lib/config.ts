import path from "node:path";
import {
  DEFAULT_AUTH_PASSWORD,
  DEFAULT_AUTH_USERNAME,
  resolveAuthCredentials,
} from "@/lib/security/auth-defaults";

function resolvePath(value: string | undefined, fallback: string): string {
  const raw = value?.trim() || fallback;
  return path.resolve(raw);
}

const auth = resolveAuthCredentials(
  process.env.AUTH_USERNAME,
  process.env.AUTH_PASSWORD,
);

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
  authUsername: auth.username,
  authPassword: auth.password,
  authIsDefault:
    auth.username === DEFAULT_AUTH_USERNAME &&
    auth.password === DEFAULT_AUTH_PASSWORD,
  serviceMode: process.env.TEXT_JELLYFIN_SERVICE === "1",
  desktopMode:
    process.env.TEXT_JELLYFIN_DESKTOP === "1" ||
    process.env.TEXT_JELLYFIN_SERVICE === "1",
  get authEnabled() {
    return Boolean(this.authUsername && this.authPassword);
  },
  adapterTimeoutMs: Number(process.env.ADAPTER_TIMEOUT_MS || 60_000),
  wordsPerMinute: 220,
};

export type AppConfig = typeof config;
