import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const standalone = join(process.cwd(), ".next", "standalone");

async function copyRuntimeDirectory(source, destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true });
}

await copyRuntimeDirectory(join(process.cwd(), ".next", "static"), join(standalone, ".next", "static"));
await copyRuntimeDirectory(join(process.cwd(), "public"), join(standalone, "public"));
