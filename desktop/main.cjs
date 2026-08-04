const { app, BrowserWindow, dialog, ipcMain, session, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const APP_NAME = "Text Jellyfin";
const UPDATE_STATUS_EVENT = "text-jellyfin:update-status";
const DEFAULT_PORT = Number(process.env.TEXT_JELLYFIN_PORT || process.env.PORT || 3000);

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

function authCredentials() {
  return {
    username: process.env.AUTH_USERNAME?.trim() || "admin",
    password: process.env.AUTH_PASSWORD || "admin",
  };
}

function lanIpv4Addresses() {
  const addresses = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      const family = typeof entry.family === "string" ? entry.family : String(entry.family);
      if ((family === "IPv4" || family === "4") && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return [...new Set(addresses)];
}

function lanUrls(port) {
  return lanIpv4Addresses().map((address) => `http://${address}:${port}`);
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

function canListen(port, host) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, host, () => {
      probe.close(() => resolve(true));
    });
  });
}

async function resolveListenPort() {
  if (await canListen(DEFAULT_PORT, "0.0.0.0")) return DEFAULT_PORT;

  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "0.0.0.0", () => {
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

function installDesktopAuthHelpers() {
  const { username, password } = authCredentials();
  const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (!headers.Authorization && !headers.authorization) {
      headers.Authorization = `Basic ${token}`;
    }
    callback({ requestHeaders: headers });
  });

  app.on("login", (event, _webContents, _request, _authInfo, callback) => {
    event.preventDefault();
    callback(username, password);
  });
}

async function startLocalServer() {
  serverPort = await resolveListenPort();
  const libraryPath = process.env.LIBRARY_PATH || path.join(app.getPath("documents"), "Text Jellyfin Library");
  const dataPath = process.env.DATA_PATH || app.getPath("userData");
  const { username, password } = authCredentials();
  fs.mkdirSync(libraryPath, { recursive: true });
  fs.mkdirSync(dataPath, { recursive: true });

  const environment = {
    ...process.env,
    AUTH_PASSWORD: password,
    AUTH_USERNAME: username,
    DATA_PATH: dataPath,
    ELECTRON_RUN_AS_NODE: "1",
    HOSTNAME: "0.0.0.0",
    LIBRARY_PATH: libraryPath,
    NODE_ENV: app.isPackaged ? "production" : "development",
    PORT: String(serverPort),
    TEXT_JELLYFIN_DESKTOP: "1",
  };

  const entrypoint = app.isPackaged
    ? path.join(serverRoot(), "server.js")
    : path.join(appRoot(), "node_modules", "next", "dist", "bin", "next");
  const args = app.isPackaged
    ? [entrypoint]
    : [entrypoint, "dev", "--hostname", "0.0.0.0", "--port", String(serverPort)];

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
  const { username, password } = authCredentials();

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
  mainWindow.webContents.on("login", (event, _authenticationResponseDetails, _authInfo, callback) => {
    event.preventDefault();
    callback(username, password);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${serverPort}`)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
}

function currentLibraryPath() {
  return process.env.LIBRARY_PATH || path.join(app.getPath("documents"), "Text Jellyfin Library");
}

function currentDataPath() {
  return process.env.DATA_PATH || app.getPath("userData");
}

function wipeDesktopServerData() {
  const dataPath = path.resolve(currentDataPath());
  const libraryPath = path.resolve(currentLibraryPath());
  if (dataPath === libraryPath) {
    throw new Error("Refusing to wipe server data because DATA_PATH and LIBRARY_PATH are the same.");
  }

  const dbPath = path.join(dataPath, "catalog.db");
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = `${dbPath}${suffix}`;
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
  }

  const cachePath = path.join(dataPath, "cache");
  if (fs.existsSync(cachePath)) fs.rmSync(cachePath, { recursive: true, force: true });
}

function findUninstaller() {
  const directory = path.dirname(process.execPath);
  const candidates = [
    path.join(directory, `Uninstall ${APP_NAME}.exe`),
    path.join(directory, "Uninstall Text Jellyfin.exe"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function deleteServer() {
  setLaunchAtStartup(false);

  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  wipeDesktopServerData();

  const uninstaller = app.isPackaged ? findUninstaller() : null;
  if (uninstaller) {
    spawn(uninstaller, ["/S"], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  }

  setTimeout(() => app.quit(), 250);
  return {
    ok: true,
    message: uninstaller
      ? "Server data deleted. The uninstaller is starting. Library files were kept."
      : "Server data deleted. Library files were kept.",
  };
}

function desktopStatus() {
  const { username } = authCredentials();
  return {
    isDesktop: true,
    launchAtStartup: launchAtStartupEnabled(),
    platform: process.platform,
    update: updateStatus,
    port: serverPort || DEFAULT_PORT,
    lanUrls: lanUrls(serverPort || DEFAULT_PORT),
    authUsername: username,
  };
}

function registerIpcHandlers() {
  ipcMain.handle("desktop:get-status", () => desktopStatus());
  ipcMain.handle("desktop:set-launch-at-startup", (_, enabled) => setLaunchAtStartup(enabled));
  ipcMain.handle("desktop:check-for-updates", () => checkForUpdates());
  ipcMain.handle("desktop:download-update", () => downloadUpdate());
  ipcMain.handle("desktop:install-update", () => {
    if (updateStatus.status === "downloaded") autoUpdater.quitAndInstall(true, true);
  });
  ipcMain.handle("desktop:delete-server", () => deleteServer());
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.textjellyfin.app");
  setLaunchAtStartup(readPreferences().launchAtStartup);
  configureUpdateEvents();
  installDesktopAuthHelpers();
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
