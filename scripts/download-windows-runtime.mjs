import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { NODE_RUNTIME, WINSW_RUNTIME } from "./windows-runtime-pins.mjs";

const cacheDirectory = path.join(process.cwd(), ".cache", "windows-service");

function digest(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function verifiedDownload(artifact) {
  await mkdir(cacheDirectory, { recursive: true });
  const destination = path.join(cacheDirectory, artifact.fileName);

  try {
    const existing = await readFile(destination);
    if (digest(existing) === artifact.sha256) return destination;
    console.warn(`Discarding cached ${artifact.fileName}: SHA-256 did not match.`);
  } catch {
    // A cache miss is expected on clean builds.
  }

  console.log(`Downloading pinned ${artifact.fileName}…`);
  const response = await fetch(artifact.url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Download failed for ${artifact.url}: HTTP ${response.status}`);
  }
  const contents = Buffer.from(await response.arrayBuffer());
  const actual = digest(contents);
  if (actual !== artifact.sha256) {
    throw new Error(
      `SHA-256 mismatch for ${artifact.fileName}: expected ${artifact.sha256}, received ${actual}`,
    );
  }
  await writeFile(destination, contents);
  return destination;
}

export async function downloadWindowsRuntime() {
  const [nodeArchive, winswExecutable] = await Promise.all([
    verifiedDownload(NODE_RUNTIME),
    verifiedDownload(WINSW_RUNTIME),
  ]);
  return { nodeArchive, winswExecutable };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await downloadWindowsRuntime();
  console.log("Pinned Windows service runtimes are present and verified.");
}
