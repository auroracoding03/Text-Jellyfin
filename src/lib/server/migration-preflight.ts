export type MigrationPreflight = {
  serviceInstalled: boolean;
  oldClientRunning: boolean;
  fixedPortAvailable: boolean;
};

export function validateMigrationPreflight(state: MigrationPreflight): {
  mode: "migration" | "machine-update";
  shouldCreateFreshData: boolean;
  shouldBackupDerivedDatabase: boolean;
} {
  if (state.oldClientRunning) {
    throw new Error("Quit the v0.9 Text Jellyfin client before migration.");
  }
  if (!state.fixedPortAvailable) {
    throw new Error("Port 3000 must be available for Windows Service mode.");
  }
  return state.serviceInstalled
    ? {
        mode: "machine-update",
        shouldCreateFreshData: false,
        shouldBackupDerivedDatabase: true,
      }
    : {
        mode: "migration",
        shouldCreateFreshData: true,
        shouldBackupDerivedDatabase: false,
      };
}
