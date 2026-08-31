import { existsSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertUpdaterStaged } from "./stage-desktop-updater.mjs";

export const DEFAULT_UNPACKED_ROOT = join(process.cwd(), "dist", "win-unpacked");

export function packagedUpdaterPaths(unpackedRoot) {
  return {
    vendorDir: join(unpackedRoot, "resources", "app", "desktop", "vendor", "updater"),
    appUpdateYml: join(unpackedRoot, "resources", "app-update.yml"),
  };
}

export function verifyPackagedUpdater(unpackedRoot) {
  if (!unpackedRoot) {
    throw new Error("verifyPackagedUpdater requires unpackedRoot");
  }

  const { vendorDir, appUpdateYml } = packagedUpdaterPaths(unpackedRoot);
  if (!existsSync(vendorDir)) {
    throw new Error(`Packaged updater vendor is missing: ${vendorDir}`);
  }

  assertUpdaterStaged(vendorDir);

  if (!existsSync(appUpdateYml)) {
    throw new Error(`Packaged app-update.yml is missing: ${appUpdateYml}`);
  }

  return { vendorDir, appUpdateYml };
}

function isCli() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return normalize(fileURLToPath(import.meta.url)) === normalize(resolve(invoked));
}

if (isCli()) {
  const unpackedRoot = process.argv[2] || DEFAULT_UNPACKED_ROOT;
  try {
    verifyPackagedUpdater(unpackedRoot);
    process.stdout.write(`Packaged updater OK: ${unpackedRoot}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
