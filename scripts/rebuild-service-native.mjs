import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

if (process.platform !== "win32") {
  throw new Error("better-sqlite3 service rebuild must run on Windows x64.");
}
if (process.arch !== "x64" || Number(process.versions.node.split(".")[0]) !== 24) {
  throw new Error(`Expected Windows x64 Node 24, received ${process.platform} ${process.arch} Node ${process.version}.`);
}

const require = createRequire(import.meta.url);
const betterSqliteDirectory = path.dirname(require.resolve("better-sqlite3/package.json"));
const nodeGypDirectory = path.dirname(require.resolve("node-gyp/package.json"));

const rebuild = spawnSync(
  process.execPath,
  [
    path.join(nodeGypDirectory, "bin", "node-gyp.js"),
    "rebuild",
    "--release",
    "--force_build=1",
  ],
  { cwd: betterSqliteDirectory, stdio: "inherit" },
);
if (rebuild.error) throw rebuild.error;
if (rebuild.status !== 0) process.exit(rebuild.status || 1);

const verify = spawnSync(
  process.execPath,
  ["scripts/verify-service-runtime.cjs", process.cwd()],
  { encoding: "utf8", stdio: "inherit" },
);
if (verify.error) throw verify.error;
if (verify.status !== 0) process.exit(verify.status || 1);
