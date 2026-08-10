import { spawnSync } from "node:child_process";

if (process.platform !== "win32") {
  throw new Error("better-sqlite3 service rebuild must run on Windows x64.");
}
if (process.arch !== "x64" || Number(process.versions.node.split(".")[0]) !== 24) {
  throw new Error(`Expected Windows x64 Node 24, received ${process.platform} ${process.arch} Node ${process.version}.`);
}

const rebuild = spawnSync(
  "npm.cmd",
  ["rebuild", "better-sqlite3", "--build-from-source"],
  { encoding: "utf8", shell: false, stdio: "inherit" },
);
if (rebuild.status !== 0) process.exit(rebuild.status || 1);

const verify = spawnSync(
  process.execPath,
  ["scripts/verify-service-runtime.cjs", process.cwd()],
  { encoding: "utf8", stdio: "inherit" },
);
if (verify.status !== 0) process.exit(verify.status || 1);
