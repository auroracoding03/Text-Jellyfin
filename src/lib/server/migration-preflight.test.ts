import { describe, expect, it } from "vitest";
import { validateMigrationPreflight } from "@/lib/server/migration-preflight";

describe("Windows migration preflight", () => {
  it("requires the old client to exit and fixed port 3000 to be free", () => {
    expect(() =>
      validateMigrationPreflight({
        serviceInstalled: false,
        oldClientRunning: true,
        fixedPortAvailable: true,
      }),
    ).toThrow("Quit the v0.9");
    expect(() =>
      validateMigrationPreflight({
        serviceInstalled: false,
        oldClientRunning: false,
        fixedPortAvailable: false,
      }),
    ).toThrow("Port 3000");
  });

  it("creates fresh data for migration and backs up derived data on updates", () => {
    expect(
      validateMigrationPreflight({
        serviceInstalled: false,
        oldClientRunning: false,
        fixedPortAvailable: true,
      }),
    ).toMatchObject({ mode: "migration", shouldCreateFreshData: true });
    expect(
      validateMigrationPreflight({
        serviceInstalled: true,
        oldClientRunning: false,
        fixedPortAvailable: true,
      }),
    ).toMatchObject({ mode: "machine-update", shouldBackupDerivedDatabase: true });
  });
});
