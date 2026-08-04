const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const APP_NAME = "Text Jellyfin";
const UPDATE_STATUS_EVENT = "text-jellyfin:update-status";

let mainWindow;
let serverProcess;
let serverPort;
let updateStatus = { status: "idle", message: "Ready to check for updates." };

function appRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, "app") : path.join(__dirname, "..");
}

function serverRoot() {
  return path.join(appRoot(), ".next", "standalone");
}

function preferencesPath() {
  return path.join(app.getPath("userData"), "desktop-preferences.json");
}

function readPreferences() {
  try {
    return { launchAtStartup: true, ...JSON.parse(fs.readFileSync(preferencesPath(), "utf8")) };
  } catch {
    return { launchAtStartup: true };
  }
}

function writePreferences(preferences) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(preferencesPath(), JSON.stringify(preferences, null, 2));
}

function setLaunchAtStartup(enabled) {
  const preferences = { ...readPreferences(), launchAtStartup: Boolean(enabled) };
  writePreferences(preferences);

  if (process.platform === "win32" || process.platform === "darwin") {
    app.setLoginItemSettings({ openAtLogin: preferences.launchAtStartup, openAsHidden: false });
  }

  return preferences.launchAtStartup;
}

function launchAtStartupEnabled() {
  if (process.platform === "win32" || process.platform === "darwin") {
    return app.getLoginItemSettings().openAtLogin;
  }
  return readPreferences().launchAtStartup;
}

function publishUpdateStatus(nextStatus) {
  updateStatus = nextStatus;
  mainWindow?.webContents.send(UPDATE_STATUS_EVENT, updateStatus);
}

function configureAutoUpdater() {
  if (app.isPackaged && !fs.existsSync(path.join(process.resourcesPath, "app-update.yml"))) {
    publishUpdateStatus({
      status: "unavailable",
      message: "Updates are not configured for this build.",
    });
    return false;
  }

  if (!app.isPackaged) {
    const url = process.env.TEXT_JELLYFIN_UPDATE_URL;
    if (!url) {
      publishUpdateStatus({
        status: "unavailable",
        message: "Updates are available in installed release builds.",
      });
      return false;
    }
    autoUpdater.setFeedURL({ provider: "generic", url });
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  return true;
}

async function checkForUpdates() {
  if (!configureAutoUpdater()) return updateStatus;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    publishUpdateStatus({
      status: "error",
      message: `Could not check for updates: ${error.message}`,
    });
  }
  return updateStatus;
}

async function downloadUpdate() {
  if (updateStatus.status !== "available") return updateStatus;
  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    publishUpdateStatus({
      status: "error",
      message: `Could not download the update: ${error.message}`,
    });
  }
  return updateStatus;
}

function configureUpdateEvents() {
  autoUpdater.on("checking-for-update", () => {
    publishUpdateStatus({ status: "checking", message: "Checking for a new release…" });
  });
  autoUpdater.on("update-available", (info) => {
    publishUpdateStatus({
      status: "available",
      version: info.version,
      message: `Version ${info.version} is ready to download.`,
    });
  });
  autoUpdater.on("update-not-available", () => {
    publishUpdateStatus({ status: "not-available", message: "You are up to date." });
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
      message: `Version ${info.version} is ready. Restart to install it.`,
    });
  });
  autoUpdater.on("error", (error) => {
    publishUpdateStatus({ status: "error", message: `Update error: ${error.message}` });
  });
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitForServer(port, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = () => {
      const request = http.get({ hostname: "127.0.0.1", port, path: "/", timeout: 1200 }, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error("The local Text Jellyfin server did not start in time."));
          return;
        }
        setTimeout(attempt, 250);
      });
      request.on("timeout", () => request.destroy());
    };
    attempt();
  });
}

async function startLocalServer() {
  serverPort = await getAvailablePort();
  const libraryPath = process.env.LIBRARY_PATH || path.join(app.getPath("documents"), "Text Jellyfin Library");
  const dataPath = process.env.DATA_PATH || app.getPath("userData");
  fs.mkdirSync(libraryPath, { recursive: true });
  fs.mkdirSync(dataPath, { recursive: true });

  const environment = {
    ...process.env,
    DATA_PATH: dataPath,
    ELECTRON_RUN_AS_NODE: "1",
    HOSTNAME: "127.0.0.1",
    LIBRARY_PATH: libraryPath,
    NODE_ENV: app.isPackaged ? "production" : "development",
    PORT: String(serverPort),
  };

  const entrypoint = app.isPackaged
    ? path.join(serverRoot(), "server.js")
    : path.join(appRoot(), "node_modules", "next", "dist", "bin", "next");
  const args = app.isPackaged
    ? [entrypoint]
    : [entrypoint, "dev", "--hostname", "127.0.0.1", "--port", String(serverPort)];

  serverProcess = spawn(process.execPath, args, {
    cwd: app.isPackaged ? serverRoot() : appRoot(),
    env: environment,
    stdio: "ignore",
    windowsHide: true,
  });
  serverProcess.once("exit", (code) => {
    if (code && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        UPDATE_STATUS_EVENT,
        { status: "error", message: `The local server stopped unexpectedly (code ${code}).` },
      );
    }
  });

  await waitForServer(serverPort);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: APP_NAME,
    icon: path.join(appRoot(), "assets", "icons", "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${serverPort}`)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
}

function registerIpcHandlers() {
  ipcMain.handle("desktop:get-status", () => ({
    isDesktop: true,
    launchAtStartup: launchAtStartupEnabled(),
    platform: process.platform,
    update: updateStatus,
  }));
  ipcMain.handle("desktop:set-launch-at-startup", (_, enabled) => setLaunchAtStartup(enabled));
  ipcMain.handle("desktop:check-for-updates", () => checkForUpdates());
  ipcMain.handle("desktop:download-update", () => downloadUpdate());
  ipcMain.handle("desktop:install-update", () => {
    if (updateStatus.status === "downloaded") autoUpdater.quitAndInstall(true, true);
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.textjellyfin.app");
  setLaunchAtStartup(readPreferences().launchAtStartup);
  configureUpdateEvents();
  registerIpcHandlers();

  try {
    await startLocalServer();
    createWindow();
    void checkForUpdates();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Text Jellyfin.";
    dialog.showErrorBox(APP_NAME, message);
    app.quit();
  }
});

app.on("before-quit", () => serverProcess?.kill());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
