import fs from "node:fs";
import path from "node:path";

export function assertWithinRoot(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative.includes(`..${path.sep}`)
  ) {
    throw new Error(`Path escapes root: ${candidate}`);
  }

  return resolvedCandidate;
}

/**
 * Resolve both paths before comparing them so a symlink cannot turn a
 * lexically-safe path into a read outside its configured root.
 *
 * The candidate must exist. Use assertWithinRoot when constructing a new path.
 */
export function assertRealPathWithinRoot(root: string, candidate: string): string {
  const resolvedCandidate = assertWithinRoot(root, candidate);
  const realRoot = fs.realpathSync(root);
  const realCandidate = fs.realpathSync(resolvedCandidate);
  return assertWithinRoot(realRoot, realCandidate);
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function toPosixRelative(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join("/");
}
