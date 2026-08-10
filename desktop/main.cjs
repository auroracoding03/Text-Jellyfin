const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, session, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { readServiceConfig } = require("./service/config.cjs");
const { serverOwnership } = require("./runtime-policy.cjs");

const APP_ID = "com.textjellyfin.machine";
const APP_NAME = "Text Jellyfin";
const UPDATE_CHANNEL = "machine";
const UPDATE_STATUS_EVENT = "text-jellyfin:update-status";
const DEFAULT_PREFERENCES = {
  launchAtStartup: false,
  startInTray: false,
};

app.setPath("userData", path.join(app.getPath("appData"), "Text Jellyfin Machine"));

let mainWindow;
let tray;
let serverConfig;
let serverHealth;
let isQuitting = false;
let updateStatus = { status: "idle", message: "Ready to check for machine updates." };

function appRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, "app") : path.join(__dirname, "..");
}

function appIconPath() {
  return path.join(appRoot(), "assets", "icons", "icon.ico");
}

function preferencesPath() {
  return path.join(app.getPath("userData"), "desktop-preferences.json");
}

function readPreferences() {
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(fs.readFileSync(preferencesPath(), "utf8")) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function writePreferences(preferences) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(preferencesPath(), JSON.stringify(preferences, null, 2));
}

function applyLoginItemSettings(preferences = readPreferences()) {
  if (process.platform === "win32" || process.platform === "darwin") {
    app.setLoginItemSettings({
      openAtLogin: Boolean(preferences.launchAtStartup),
      args: preferences.startInTray ? ["--hidden"] : [],
    });
  }
}

function setLaunchAtStartup(enabled) {
  const preferences = { ...readPreferences(), launchAtStartup: Boolean(enabled) };
  writePreferences(preferences);
  applyLoginItemSettings(preferences);
  return preferences.launchAtStartup;
}

function setStartInTray(enabled) {
  const preferences = { ...readPreferences(), startInTray: Boolean(enabled) };
  writePreferences(preferences);
  applyLoginItemSettings(preferences);
  if (preferences.startInTray) createTray();
  else destroyTray();
  return preferences.startInTray;
}

function launchAtStartupEnabled() {
  if (process.platform === "win32" || process.platform === "darwin") {
    return app.getLoginItemSettings().openAtLogin;
  }
  return readPreferences().launchAtStartup;
}

function shouldStartHidden() {
  return readPreferences().startInTray && process.argv.includes("--hidden");
}

function developmentConfig() {
  return {
    libraryPath: process.env.LIBRARY_PATH || path.join(app.getPath("documents"), "Text Jellyfin Library"),
    dataPath: process.env.DATA_PATH || path.join(app.getPath("userData"), "development-data"),
    port: Number(process.env.TEXT_JELLYFIN_PORT || process.env.PORT || 3000),
    auth: {
      username: process.env.AUTH_USERNAME?.trim() || "admin",
      password: process.env.AUTH_PASSWORD || "admin",
    },
  };
}

function loadServerConfig() {
  return app.isPackaged ? readServiceConfig() : developmentConfig();
}

function serverUrl() {
  return `http://127.0.0.1:${serverConfig.port}`;
}

function basicAuthHeader() {
  const token = Buffer.from(
    `${serverConfig.auth.username}:${serverConfig.auth.password}`,
    "utf8",
  ).toString("base64");
  return `Basic ${token}`;
}

function requestHealth() {
  return new Promise((resolve, reject) => {
    const request = http.get(
      {
        hostname: "127.0.0.1",
        port: serverConfig.port,
        path: "/api/health",
        timeout: 1500,
        headers: { Authorization: basicAuthHeader() },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error(`Authenticated health check returned HTTP ${response.statusCode}.`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error("Authenticated health check returned invalid JSON."));
          }
        });
      },
    );
    request.on("error", reject);
    request.on("timeout", () => request.destroy(new Error("Health check timed out.")));
  });
}

async function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const health = await requestHealth();
      if (health?.status !== "ok" || health?.name !== APP_NAME) {
        throw new Error("Port 3000 is serving an unexpected application.");
      }
      if (app.isPackaged && health.serviceMode !== true) {
        throw new Error("The server on port 3000 is not running in Windows Service mode.");
      }
      serverHealth = health;
      return health;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(
    `Unable to attach to the Text Jellyfin Windows Service on port ${serverConfig.port}. ` +
      `${lastError?.message || "The service is not responding."}`,
  );
}

function installDesktopAuthHelpers() {
  const expectedOrigin = `${serverUrl()}/`;
  const authorization = basicAuthHeader();
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (
      details.url.startsWith(expectedOrigin) &&
      !headers.Authorization &&
      !headers.authorization
    ) {
      headers.Authorization = authorization;
    }
    callback({ requestHeaders: headers });
  });

  app.on("login", (event, _webContents, request, authInfo, callback) => {
    if (request.url.startsWith(expectedOrigin) && authInfo.host === "127.0.0.1") {
      event.preventDefault();
      callback(serverConfig.auth.username, serverConfig.auth.password);
    }
  });
}

function lanIpv4Addresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      const family = typeof entry.family === "string" ? entry.family : String(entry.family);
      if ((family === "IPv4" || family === "4") && !entry.internal) addresses.push(entry.address);
    }
  }
  return [...new Set(addresses)];
}

function lanUrls() {
  return lanIpv4Addresses().map((address) => `http://${address}:${serverConfig.port}`);
}

function publishUpdateStatus(nextStatus) {
  updateStatus = nextStatus;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(UPDATE_STATUS_EVENT, updateStatus);
  }
}

function configureAutoUpdater() {
  if (app.isPackaged && !fs.existsSync(path.join(process.resourcesPath, "app-update.yml"))) {
    publishUpdateStatus({
      status: "unavailable",
      message: "Machine updates are not configured for this build.",
    });
    return false;
  }
  if (!app.isPackaged) {
    publishUpdateStatus({
      status: "unavailable",
      message: "Updates are available only in installed machine builds.",
    });
    return false;
  }
  autoUpdater.channel = UPDATE_CHANNEL;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  return true;
}

async function checkForUpdates() {
  if (!configureAutoUpdater()) return updateStatus;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    publishUpdateStatus({ status: "error", message: `Could not check for updates: ${error.message}` });
  }
  return updateStatus;
}

async function downloadUpdate() {
  if (updateStatus.status !== "available") return updateStatus;
  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    publishUpdateStatus({ status: "error", message: `Could not download update: ${error.message}` });
  }
  return updateStatus;
}

function configureUpdateEvents() {
  autoUpdater.on("checking-for-update", () => {
    publishUpdateStatus({ status: "checking", message: "Checking the machine update channel…" });
  });
  autoUpdater.on("update-available", (info) => {
    publishUpdateStatus({
      status: "available",
      version: info.version,
      message: `Machine version ${info.version} is ready to download.`,
    });
  });
  autoUpdater.on("update-not-available", () => {
    publishUpdateStatus({ status: "not-available", message: "The machine installation is up to date." });
  });
  autoUpdater.on("download-progress", (progress) => {
    publishUpdateStatus({
      status: "downloading",
      percent: Math.round(progress.percent),
      message: `Downloading update… ${Math.round(progress.percent)}%`,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishUpdateStatus({
      status: "downloaded",
      version: info.version,
      message: `Version ${info.version} is ready. Installing it requires UAC approval.`,
    });
  });
  autoUpdater.on("error", (error) => {
    publishUpdateStatus({ status: "error", message: `Update error: ${error.message}` });
  });
}

function createTrayIcon() {
  const icon = nativeImage.createFromPath(appIconPath());
  return icon.isEmpty() ? nativeImage.createEmpty() : icon;
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setSkipTaskbar(false);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setSkipTaskbar(true);
  mainWindow.hide();
}

function destroyTray() {
  tray?.destroy();
  tray = undefined;
}

function createTray() {
  if (tray || !readPreferences().startInTray) return;
  tray = new Tray(createTrayIcon());
  tray.setToolTip(`${APP_NAME} client`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Text Jellyfin", click: showMainWindow },
      { label: "Open in browser", click: () => void shell.openExternal(serverUrl()) },
      { type: "separator" },
      { label: "Quit client", click: () => app.quit() },
    ]),
  );
  tray.on("double-click", showMainWindow);
}

function createWindow({ startHidden }) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    show: false,
    skipTaskbar: Boolean(startHidden),
    title: APP_NAME,
    icon: appIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (startHidden) hideToTray();
    else showMainWindow();
  });
  mainWindow.on("close", (event) => {
    if (isQuitting || !readPreferences().startInTray) return;
    event.preventDefault();
    hideToTray();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`${serverUrl()}/`)) void shell.openExternal(url);
    return { action: "deny" };
  });
  void mainWindow.loadURL(serverUrl());
}

function desktopStatus() {
  return {
    isDesktop: true,
    launchAtStartup: launchAtStartupEnabled(),
    startInTray: readPreferences().startInTray,
    platform: process.platform,
    update: updateStatus,
    port: serverConfig.port,
    lanUrls: lanUrls(),
    authUsername: serverConfig.auth.username,
    service: {
      healthy: serverHealth?.status === "ok",
      mode: Boolean(serverHealth?.serviceMode),
      version: serverHealth?.version || "unknown",
      ownership: serverOwnership({ isPackaged: app.isPackaged }),
    },
  };
}

function registerIpcHandlers() {
  ipcMain.handle("desktop:get-status", () => desktopStatus());
  ipcMain.handle("desktop:set-launch-at-startup", (_, enabled) => setLaunchAtStartup(enabled));
  ipcMain.handle("desktop:set-start-in-tray", (_, enabled) => setStartInTray(enabled));
  ipcMain.handle("desktop:show-window", () => {
    showMainWindow();
    return true;
  });
  ipcMain.handle("desktop:hide-to-tray", () => {
    hideToTray();
    return true;
  });
  ipcMain.handle("desktop:check-for-updates", () => checkForUpdates());
  ipcMain.handle("desktop:download-update", () => downloadUpdate());
  ipcMain.handle("desktop:install-update", () => {
    if (updateStatus.status === "downloaded") {
      isQuitting = true;
      autoUpdater.quitAndInstall(true, true);
    }
  });
  ipcMain.handle("desktop:open-services", () => shell.openPath("C:\\Windows\\System32\\services.msc"));
}

async function startApplication() {
  app.setAppUserModelId(APP_ID);
  serverConfig = loadServerConfig();
  configureUpdateEvents();
  installDesktopAuthHelpers();
  registerIpcHandlers();
  applyLoginItemSettings();
  await waitForServer();
  createTray();
  createWindow({ startHidden: shouldStartHidden() });
  void checkForUpdates();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", showMainWindow);
  app.whenReady().then(() => startApplication()).catch((error) => {
    dialog.showErrorBox(APP_NAME, error instanceof Error ? error.message : "Unable to open Text Jellyfin.");
    isQuitting = true;
    app.quit();
  });
}

app.on("before-quit", () => {
  isQuitting = true;
  destroyTray();
});

app.on("activate", showMainWindow);

app.on("window-all-closed", () => {
  if (!readPreferences().startInTray) app.quit();
});
