function serverOwnership({ isPackaged }) {
  return isPackaged ? "external-service" : "development-only";
}

function maySpawnServer(options) {
  return serverOwnership(options) === "development-only";
}

module.exports = { maySpawnServer, serverOwnership };
