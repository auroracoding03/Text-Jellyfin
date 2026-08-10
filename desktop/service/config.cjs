const fs = require("node:fs");
const path = require("node:path");

const FIXED_SERVICE_PORT = 3000;
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "admin";

function programDataRoot(environment = process.env) {
  const programData = environment.ProgramData || environment.PROGRAMDATA;
  if (!programData) {
    throw new Error("ProgramData is not set; the Windows service configuration cannot be located.");
  }
  return path.win32.join(programData, "TextJellyfin");
}

function configPath(environment = process.env) {
  return environment.TEXT_JELLYFIN_CONFIG || path.win32.join(programDataRoot(environment), "server.json");
}

function requireAbsoluteWindowsPath(value, name) {
  if (typeof value !== "string" || !path.win32.isAbsolute(value.trim())) {
    throw new Error(`${name} must be an absolute Windows path.`);
  }
  return path.win32.normalize(value.trim());
}

function validateServiceConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("server.json must contain a JSON object.");
  }

  const libraryPath = requireAbsoluteWindowsPath(value.libraryPath, "libraryPath");
  const dataPath = requireAbsoluteWindowsPath(value.dataPath, "dataPath");
  const port = Number(value.port);
  const username = typeof value.auth?.username === "string" ? value.auth.username.trim() : "";
  const password = typeof value.auth?.password === "string" ? value.auth.password : "";

  if (libraryPath.toLowerCase() === dataPath.toLowerCase()) {
    throw new Error("libraryPath and dataPath must be different; DATA_PATH is disposable.");
  }
  if (port !== FIXED_SERVICE_PORT) {
    throw new Error(`Service mode requires fixed port ${FIXED_SERVICE_PORT}.`);
  }
  if (!username || !password) {
    throw new Error("Service Basic Auth username and password are required.");
  }
  if (username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
    throw new Error("Service mode refuses the default admin/admin credentials.");
  }

  return {
    libraryPath,
    dataPath,
    port,
    auth: { username, password },
  };
}

function readServiceConfig(filePath = configPath()) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read service configuration at ${filePath}: ${error.message}`);
  }

  try {
    return validateServiceConfig(JSON.parse(raw));
  } catch (error) {
    throw new Error(`Invalid service configuration at ${filePath}: ${error.message}`);
  }
}

function serviceEnvironment(configuration, environment = process.env) {
  return {
    ...environment,
    AUTH_PASSWORD: configuration.auth.password,
    AUTH_USERNAME: configuration.auth.username,
    DATA_PATH: configuration.dataPath,
    HOSTNAME: "0.0.0.0",
    LIBRARY_PATH: configuration.libraryPath,
    NODE_ENV: "production",
    PORT: String(FIXED_SERVICE_PORT),
    TEXT_JELLYFIN_SERVICE: "1",
    TEXT_JELLYFIN_VERSION: "0.10.0",
  };
}

module.exports = {
  FIXED_SERVICE_PORT,
  configPath,
  programDataRoot,
  readServiceConfig,
  serviceEnvironment,
  validateServiceConfig,
};
