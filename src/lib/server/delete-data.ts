import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { resetDbConnection } from "@/lib/catalog/db";
import { assertWithinRoot, ensureDir } from "@/lib/security/paths";

function removePathIfPresent(target: string): void {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

/**
 * Removes catalog database files and the article cache under DATA_PATH.
 * Never touches LIBRARY_PATH (source documents and uploads stay on disk).
 */
export function wipeServerData(): { dataPath: string; libraryPath: string } {
  const dataPath = path.resolve(config.dataPath);
  const libraryPath = path.resolve(config.libraryPath);

  if (dataPath === libraryPath) {
    throw new Error(
      "Refusing to wipe server data because DATA_PATH and LIBRARY_PATH are the same.",
    );
  }

  // Ensure db/cache paths cannot escape DATA_PATH before deleting them.
  assertWithinRoot(dataPath, config.dbPath);
  assertWithinRoot(dataPath, config.cachePath);

  resetDbConnection();

  for (const suffix of ["", "-wal", "-shm"]) {
    removePathIfPresent(`${config.dbPath}${suffix}`);
  }
  removePathIfPresent(config.cachePath);

  ensureDir(dataPath);
  ensureDir(config.cachePath);

  return { dataPath, libraryPath };
}
