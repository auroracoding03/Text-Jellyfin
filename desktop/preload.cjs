const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("textJellyfinDesktop", {
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
  deleteServer: () => ipcRenderer.invoke("desktop:delete-server"),
  downloadUpdate: () => ipcRenderer.invoke("desktop:download-update"),
  getStatus: () => ipcRenderer.invoke("desktop:get-status"),
  installUpdate: () => ipcRenderer.invoke("desktop:install-update"),
  onUpdateStatus: (listener) => {
    const callback = (_, status) => listener(status);
    ipcRenderer.on("text-jellyfin:update-status", callback);
    return () => ipcRenderer.removeListener("text-jellyfin:update-status", callback);
  },
  setLaunchAtStartup: (enabled) => ipcRenderer.invoke("desktop:set-launch-at-startup", enabled),
});
