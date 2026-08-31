const fs = require("node:fs");

function ensureVendorPath(vendorDir) {
  if (!vendorDir || !fs.existsSync(vendorDir)) return;
  if (!module.paths.includes(vendorDir)) {
    module.paths.unshift(vendorDir);
  }
}

function loadAutoUpdater({ vendorDir, requireFn } = {}) {
  if (!requireFn) {
    ensureVendorPath(vendorDir);
  }

  const load = requireFn || require;
  try {
    const loaded = load("electron-updater");
    const autoUpdater = loaded && loaded.autoUpdater ? loaded.autoUpdater : null;
    if (!autoUpdater) {
      return {
        autoUpdater: null,
        loadError: "electron-updater loaded without autoUpdater",
      };
    }
    return { autoUpdater, loadError: null };
  } catch (error) {
    return {
      autoUpdater: null,
      loadError: error instanceof Error ? error.message : String(error),
    };
  }
}

function describeAvailability({
  autoUpdater,
  loadError,
  isPackaged,
  hasAppUpdateYml,
  genericFeedUrl,
} = {}) {
  if (!autoUpdater) {
    return {
      ready: false,
      status: "unavailable",
      message: loadError
        ? `Application updates are unavailable: ${loadError}`
        : "Application updates are unavailable in this build.",
    };
  }

  if (isPackaged && !hasAppUpdateYml) {
    return {
      ready: false,
      status: "unavailable",
      message: "Updates are not configured for this build.",
    };
  }

  if (!isPackaged) {
    const url = typeof genericFeedUrl === "string" ? genericFeedUrl.trim() : "";
    if (!url) {
      return {
        ready: false,
        status: "unavailable",
        message: "Updates are available in installed release builds.",
      };
    }
    return { ready: true, genericFeedUrl: url };
  }

  return { ready: true };
}

async function runUpdateAction(action, prefix) {
  try {
    await action();
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { status: "error", message: `${prefix}: ${detail}` };
  }
}

module.exports = {
  describeAvailability,
  loadAutoUpdater,
  runUpdateAction,
};
