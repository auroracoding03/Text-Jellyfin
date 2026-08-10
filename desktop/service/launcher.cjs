const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { readServiceConfig, serviceEnvironment } = require("./config.cjs");

function assertPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", (error) => {
      reject(
        new Error(
          `Text Jellyfin requires port ${port}, but it is unavailable (${error.code || error.message}).`,
        ),
      );
    });
    probe.listen(port, "0.0.0.0", () => probe.close(resolve));
  });
}

async function main() {
  const configuration = readServiceConfig();
  fs.mkdirSync(configuration.libraryPath, { recursive: true });
  fs.mkdirSync(configuration.dataPath, { recursive: true });
  await assertPortAvailable(configuration.port);

  Object.assign(process.env, serviceEnvironment(configuration));
  const serverPath = path.join(__dirname, "server", "server.js");
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Packaged Next.js server is missing: ${serverPath}`);
  }

  process.chdir(path.dirname(serverPath));
  require(serverPath);
}

main().catch((error) => {
  console.error(`[Text Jellyfin service] ${error.stack || error.message}`);
  process.exitCode = 1;
});
