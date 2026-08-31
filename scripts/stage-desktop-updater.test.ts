import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertUpdaterStaged,
  resolveFromVendor,
  stageDesktopUpdater,
} from "./stage-desktop-updater.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe("stageDesktopUpdater", () => {
  let destination = "";

  afterEach(async () => {
    if (destination) {
      await rm(destination, { recursive: true, force: true });
      destination = "";
    }
  });

  it("copies electron-updater so Node can resolve it from the vendor dir", async () => {
    destination = await mkdtemp(join(tmpdir(), "text-jellyfin-updater-"));
    await stageDesktopUpdater({ projectRoot, destination });

    const updaterPath = assertUpdaterStaged(destination);
    expect(resolveFromVendor(destination)).toBe(updaterPath);
    expect(updaterPath).toContain(`${join("electron-updater")}`);
  });
});
