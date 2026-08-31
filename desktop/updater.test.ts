import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const {
  describeAvailability,
  loadAutoUpdater,
  runUpdateAction,
} = createRequire(import.meta.url)("./updater.cjs") as {
  describeAvailability: (input?: Record<string, unknown>) => {
    ready: boolean;
    status?: string;
    message?: string;
    genericFeedUrl?: string;
  };
  loadAutoUpdater: (input?: {
    vendorDir?: string;
    requireFn?: (id: string) => unknown;
  }) => { autoUpdater: unknown; loadError: string | null };
  runUpdateAction: (
    action: () => Promise<unknown> | unknown,
    prefix: string,
  ) => Promise<{ status: string; message: string } | null>;
};

const stubUpdater = {
  autoDownload: true,
  autoInstallOnAppQuit: true,
  setFeedURL: () => undefined,
};

describe("loadAutoUpdater", () => {
  it("returns unavailable state when the module cannot be loaded", () => {
    const result = loadAutoUpdater({
      requireFn: () => {
        throw new Error("Cannot find module 'electron-updater'");
      },
    });

    expect(result.autoUpdater).toBeNull();
    expect(result.loadError).toContain("Cannot find module 'electron-updater'");
  });
});

describe("describeAvailability", () => {
  it("reports unavailable when the updater module is missing", () => {
    const result = describeAvailability({
      autoUpdater: null,
      loadError: "Cannot find module 'electron-updater'",
    });

    expect(result).toEqual({
      ready: false,
      status: "unavailable",
      message: "Application updates are unavailable: Cannot find module 'electron-updater'",
    });
  });

  it("reports unavailable when unpackaged and no generic feed URL is set", () => {
    const result = describeAvailability({
      autoUpdater: stubUpdater,
      isPackaged: false,
      genericFeedUrl: "",
    });

    expect(result.ready).toBe(false);
    expect(result.status).toBe("unavailable");
    expect(result.message).toMatch(/installed release builds/i);
  });

  it("reports unavailable when packaged without app-update.yml", () => {
    const result = describeAvailability({
      autoUpdater: stubUpdater,
      isPackaged: true,
      hasAppUpdateYml: false,
    });

    expect(result).toEqual({
      ready: false,
      status: "unavailable",
      message: "Updates are not configured for this build.",
    });
  });

  it("is ready for a packaged build with app-update.yml", () => {
    expect(
      describeAvailability({
        autoUpdater: stubUpdater,
        isPackaged: true,
        hasAppUpdateYml: true,
      }),
    ).toEqual({ ready: true });
  });
});

describe("runUpdateAction", () => {
  it("turns thrown check/download failures into an error status", async () => {
    const result = await runUpdateAction(async () => {
      throw new Error("404 Not Found");
    }, "Could not check for updates");

    expect(result).toEqual({
      status: "error",
      message: "Could not check for updates: 404 Not Found",
    });
  });

  it("returns null when the action succeeds", async () => {
    await expect(runUpdateAction(async () => undefined, "Could not check for updates")).resolves.toBeNull();
  });
});
