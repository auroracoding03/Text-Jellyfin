import Module, { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

export const UPDATER_PACKAGE = "electron-updater";

export function defaultUpdaterVendorDir(projectRoot) {
  return join(projectRoot, "desktop", "vendor", "updater");
}

export function resolveFromVendor(destination, id = UPDATER_PACKAGE) {
  const filename = join(destination, "require-from-vendor.cjs");
  const parent = new Module(filename);
  parent.filename = filename;
  parent.paths = [destination];
  return Module._resolveFilename(id, parent, false);
}

export function assertUpdaterStaged(destination) {
  const updaterPath = resolveFromVendor(destination, UPDATER_PACKAGE);
  const updaterRequire = createRequire(updaterPath);
  for (const dep of ["builder-util-runtime", "fs-extra", "js-yaml", "semver"]) {
    updaterRequire.resolve(dep);
  }
  return updaterPath;
}

function resolvePackageDir(name, parentRequire) {
  try {
    return dirname(parentRequire.resolve(`${name}/package.json`));
  } catch {
    const entry = parentRequire.resolve(name);
    let dir = dirname(entry);
    while (true) {
      const candidate = join(dir, "package.json");
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, "utf8"));
        if (pkg.name === name) return dir;
      }
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error(`Unable to resolve package directory for ${name}`);
      }
      dir = parent;
    }
  }
}

function packageDestination(destination, name) {
  return join(destination, ...name.split("/"));
}

export async function stageDesktopUpdater({
  projectRoot,
  destination = defaultUpdaterVendorDir(projectRoot),
} = {}) {
  if (!projectRoot) {
    throw new Error("stageDesktopUpdater requires projectRoot");
  }

  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });

  const rootRequire = createRequire(join(projectRoot, "package.json"));
  const copiedDests = new Set();

  async function copyPackage(name, destDir, parentRequire, chain = new Set()) {
    if (copiedDests.has(destDir) || chain.has(name)) return;
    copiedDests.add(destDir);

    const pkgDir = resolvePackageDir(name, parentRequire);
    await mkdir(dirname(destDir), { recursive: true });
    await cp(pkgDir, destDir, { recursive: true });

    const pkg = JSON.parse(await readFile(join(pkgDir, "package.json"), "utf8"));
    const nestedRequire = createRequire(join(pkgDir, "package.json"));
    const nextChain = new Set(chain).add(name);
    for (const dep of Object.keys(pkg.dependencies || {})) {
      await copyPackage(
        dep,
        packageDestination(join(destDir, "node_modules"), dep),
        nestedRequire,
        nextChain,
      );
    }
  }

  await copyPackage(
    UPDATER_PACKAGE,
    packageDestination(destination, UPDATER_PACKAGE),
    rootRequire,
  );
  assertUpdaterStaged(destination);
  return destination;
}
