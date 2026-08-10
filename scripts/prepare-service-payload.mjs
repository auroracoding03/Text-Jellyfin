import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import JSZip from "jszip";
import { downloadWindowsRuntime } from "./download-windows-runtime.mjs";
import { NODE_RUNTIME, WINSW_RUNTIME } from "./windows-runtime-pins.mjs";

if (process.platform !== "win32") {
  throw new Error(
    "The Windows service payload must be prepared on Windows so better-sqlite3 is rebuilt for packaged Node 24. Use npm run download:service-runtime for a cross-platform artifact check.",
  );
}

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
const payload = path.join(root, "build", "service-payload");
const serviceSource = path.join(root, "desktop", "service");
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

if (packageJson.version !== "0.10.0") {
  throw new Error(`Service payload expected package version 0.10.0, received ${packageJson.version}.`);
}

const { nodeArchive, winswExecutable } = await downloadWindowsRuntime();
await rm(payload, { recursive: true, force: true });
await mkdir(path.join(payload, "runtime"), { recursive: true });

const nodeZip = await JSZip.loadAsync(await readFile(nodeArchive));
const nodeEntry = nodeZip.file(`node-v${NODE_RUNTIME.version}-win-x64/node.exe`);
if (!nodeEntry) throw new Error("Pinned Node archive does not contain node.exe.");
await writeFile(path.join(payload, "runtime", "node.exe"), await nodeEntry.async("nodebuffer"));

await cp(standalone, path.join(payload, "server"), { recursive: true });
await cp(winswExecutable, path.join(payload, "TextJellyfin.Service.exe"));
await cp(
  path.join(serviceSource, "TextJellyfin.Service.xml"),
  path.join(payload, "TextJellyfin.Service.xml"),
);
await cp(path.join(serviceSource, "launcher.cjs"), path.join(payload, "launcher.cjs"));
await cp(path.join(serviceSource, "config.cjs"), path.join(payload, "config.cjs"));

const verification = spawnSync(
  path.join(payload, "runtime", "node.exe"),
  [path.join(root, "scripts", "verify-service-runtime.cjs"), path.join(payload, "server")],
  { cwd: root, encoding: "utf8" },
);
if (verification.status !== 0) {
  throw new Error(
    `Packaged Node/better-sqlite3 verification failed.\n${verification.stdout}\n${verification.stderr}`,
  );
}

await writeFile(
  path.join(payload, "RUNTIME-VERSIONS.txt"),
  [
    `Node ${NODE_RUNTIME.version}`,
    `Node archive SHA-256 ${NODE_RUNTIME.sha256}`,
    `WinSW ${WINSW_RUNTIME.version}`,
    `WinSW SHA-256 ${WINSW_RUNTIME.sha256}`,
    verification.stdout.trim(),
    "",
  ].join("\n"),
);
console.log(`Prepared and verified Windows service payload at ${payload}`);
