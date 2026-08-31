import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { stageDesktopUpdater } from "./stage-desktop-updater.mjs";
import {
  packagedUpdaterPaths,
  verifyPackagedUpdater,
} from "./verify-packaged-updater.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe("verifyPackagedUpdater", () => {
  let unpackedRoot = "";

  afterEach(async () => {
    if (unpackedRoot) {
      await rm(unpackedRoot, { recursive: true, force: true });
      unpackedRoot = "";
    }
  });

  it("passes when the vendor tree and app-update.yml are present", async () => {
    unpackedRoot = await mkdtemp(join(tmpdir(), "text-jellyfin-unpacked-"));
    const { vendorDir, appUpdateYml } = packagedUpdaterPaths(unpackedRoot);
    await mkdir(dirname(vendorDir), { recursive: true });
    await stageDesktopUpdater({ projectRoot, destination: vendorDir });
    await mkdir(dirname(appUpdateYml), { recursive: true });
    await writeFile(appUpdateYml, "provider: github\n", "utf8");

    expect(verifyPackagedUpdater(unpackedRoot)).toEqual({ vendorDir, appUpdateYml });
  });

  it("fails when the vendor tree is missing", async () => {
    unpackedRoot = await mkdtemp(join(tmpdir(), "text-jellyfin-unpacked-"));
    const { appUpdateYml } = packagedUpdaterPaths(unpackedRoot);
    await mkdir(dirname(appUpdateYml), { recursive: true });
    await writeFile(appUpdateYml, "provider: github\n", "utf8");

    expect(() => verifyPackagedUpdater(unpackedRoot)).toThrow(/vendor is missing/i);
  });

  it("fails when app-update.yml is missing", async () => {
    unpackedRoot = await mkdtemp(join(tmpdir(), "text-jellyfin-unpacked-"));
    const { vendorDir } = packagedUpdaterPaths(unpackedRoot);
    await mkdir(dirname(vendorDir), { recursive: true });
    await stageDesktopUpdater({ projectRoot, destination: vendorDir });

    expect(() => verifyPackagedUpdater(unpackedRoot)).toThrow(/app-update\.yml is missing/i);
  });
});
