export const NOTE_ASSET_PREFIX = "note-assets/";

export function isSafeAssetFilename(filename: string): boolean {
  return (
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename) && !filename.includes("..")
  );
}

function decodeSrc(src: string): string {
  const trimmed = src.trim();
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

export function parseNoteAssetFilename(
  src: string,
  stem?: string,
): string | null {
  const decoded = decodeSrc(src);
  if (!decoded) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) return null;

  const posix = decoded.replace(/\\/g, "/").replace(/^\.\//, "");
  if (posix.includes("..") || posix.startsWith("/")) return null;

  if (posix.startsWith(NOTE_ASSET_PREFIX)) {
    const filename = posix.slice(NOTE_ASSET_PREFIX.length);
    if (filename.includes("/")) return null;
    return isSafeAssetFilename(filename) ? filename : null;
  }

  if (stem) {
    const prefix = `${stem}.assets/`;
    if (posix.startsWith(prefix)) {
      const filename = posix.slice(prefix.length);
      if (filename.includes("/")) return null;
      return isSafeAssetFilename(filename) ? filename : null;
    }
  }

  return null;
}

export function listNoteAssetFilenames(markdown: string): string[] {
  const found = new Set<string>();
  const pattern = /note-assets\/([A-Za-z0-9][A-Za-z0-9._-]*)/g;
  let match: RegExpExecArray | null = pattern.exec(markdown);
  while (match) {
    if (isSafeAssetFilename(match[1])) found.add(match[1]);
    match = pattern.exec(markdown);
  }
  return Array.from(found);
}

export function noteAssetMarkdownSrc(filename: string): string {
  return `${NOTE_ASSET_PREFIX}${filename}`;
}
