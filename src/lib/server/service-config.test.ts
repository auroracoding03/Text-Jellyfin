import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  configPath,
  programDataRoot,
  serviceEnvironment,
  validateServiceConfig,
} = require("../../../desktop/service/config.cjs");
const { maySpawnServer, serverOwnership } = require("../../../desktop/runtime-policy.cjs");

const validConfig = {
  libraryPath: "C:\\Users\\Aaron\\Documents\\Text Jellyfin Library",
  dataPath: "C:\\ProgramData\\TextJellyfin\\data",
  port: 3000,
  auth: { username: "reader", password: "not-the-default" },
};

describe("Windows service configuration", () => {
  it("resolves machine paths from ProgramData", () => {
    const environment = { ProgramData: "C:\\ProgramData" };
    expect(programDataRoot(environment)).toBe("C:\\ProgramData\\TextJellyfin");
    expect(configPath(environment)).toBe("C:\\ProgramData\\TextJellyfin\\server.json");
  });

  it("enforces fixed port, separate paths, and non-default credentials", () => {
    expect(validateServiceConfig(validConfig)).toEqual(validConfig);
    expect(() => validateServiceConfig({ ...validConfig, port: 3001 })).toThrow(
      "fixed port 3000",
    );
    expect(() =>
      validateServiceConfig({
        ...validConfig,
        dataPath: validConfig.libraryPath,
      }),
    ).toThrow("must be different");
    expect(() =>
      validateServiceConfig({
        ...validConfig,
        auth: { username: "admin", password: "admin" },
      }),
    ).toThrow("refuses the default");
  });

  it("maps server.json to a service-only Next.js environment", () => {
    expect(serviceEnvironment(validConfig, { SystemRoot: "C:\\Windows" })).toMatchObject({
      AUTH_USERNAME: "reader",
      DATA_PATH: validConfig.dataPath,
      HOSTNAME: "0.0.0.0",
      LIBRARY_PATH: validConfig.libraryPath,
      PORT: "3000",
      TEXT_JELLYFIN_SERVICE: "1",
      TEXT_JELLYFIN_VERSION: "0.10.0",
    });
  });
});

describe("desktop server ownership", () => {
  it("never lets a packaged Electron process own the server", () => {
    expect(serverOwnership({ isPackaged: true })).toBe("external-service");
    expect(maySpawnServer({ isPackaged: true })).toBe(false);
    expect(maySpawnServer({ isPackaged: false })).toBe(true);
  });
});
