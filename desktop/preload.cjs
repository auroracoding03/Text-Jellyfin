const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("textJellyfinDesktop", {
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("desktop:download-update"),
  getStatus: () => ipcRenderer.invoke("desktop:get-status"),
  hideToTray: () => ipcRenderer.invoke("desktop:hide-to-tray"),
  installUpdate: () => ipcRenderer.invoke("desktop:install-update"),
  openServices: () => ipcRenderer.invoke("desktop:open-services"),
  onUpdateStatus: (listener) => {
    const callback = (_, status) => listener(status);
    ipcRenderer.on("text-jellyfin:update-status", callback);
    return () => ipcRenderer.removeListener("text-jellyfin:update-status", callback);
  },
  setLaunchAtStartup: (enabled) => ipcRenderer.invoke("desktop:set-launch-at-startup", enabled),
  setStartInTray: (enabled) => ipcRenderer.invoke("desktop:set-start-in-tray", enabled),
  showWindow: () => ipcRenderer.invoke("desktop:show-window"),
});
