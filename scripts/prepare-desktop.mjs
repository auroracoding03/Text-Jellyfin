import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { stageDesktopUpdater } from "./stage-desktop-updater.mjs";

const projectRoot = process.cwd();
const standalone = join(projectRoot, ".next", "standalone");

async function copyRuntimeDirectory(source, destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true });
}

await copyRuntimeDirectory(join(projectRoot, ".next", "static"), join(standalone, ".next", "static"));
await copyRuntimeDirectory(join(projectRoot, "public"), join(standalone, "public"));
await stageDesktopUpdater({ projectRoot });
