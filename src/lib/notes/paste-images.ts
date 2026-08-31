export type ClipboardPasteKind = "image-only" | "mixed" | "none";

export type ImageSrcKind = "data" | "blob" | "file" | "remote" | "empty" | "unknown";

export type PendingPasteImage = {
  index: number;
  alt: string;
  source: Promise<File>;
};

export type PrepareMixedPasteResult = {
  html: string;
  pending: PendingPasteImage[];
  skippedImages: number;
};

const IMG_TAG_RE = /<img\b([^>]*?)\/?>/gi;

export function classifyImageSrc(src: string): ImageSrcKind {
  const trimmed = src.trim();
  if (!trimmed) return "empty";
  if (trimmed.startsWith("data:")) return "data";
  if (trimmed.startsWith("blob:")) return "blob";
  if (/^file:/i.test(trimmed)) return "file";
  if (/^https?:/i.test(trimmed)) return "remote";
  return "unknown";
}

export function imageFilesFromDataTransfer(
  data: DataTransfer | null | undefined,
): File[] {
  if (!data) return [];
  const fromFiles = Array.from(data.files || []).filter((file) =>
    file.type.startsWith("image/"),
  );
  if (fromFiles.length) return fromFiles;
  const fromItems: File[] = [];
  for (const item of Array.from(data.items || [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) fromItems.push(file);
    }
  }
  return fromItems;
}

export function classifyClipboardPaste(input: {
  html?: string;
  plain?: string;
  imageFiles?: File[];
}): ClipboardPasteKind {
  const html = input.html?.trim() || "";
  const plain = input.plain?.trim() || "";
  const files = input.imageFiles || [];
  const hasStory = Boolean(html || plain);
  const htmlHasImages = /<img\b/i.test(html);

  if (files.length && !hasStory) return "image-only";
  if (hasStory && (files.length || htmlHasImages)) return "mixed";
  return "none";
}

export function classifyClipboardDataTransfer(
  data: DataTransfer | null | undefined,
): ClipboardPasteKind {
  if (!data) return "none";
  return classifyClipboardPaste({
    html: data.getData("text/html"),
    plain: data.getData("text/plain"),
    imageFiles: imageFilesFromDataTransfer(data),
  });
}

function getImgAttr(attrs: string, name: string): string {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(
    attrs,
  );
  return match ? (match[1] ?? match[2] ?? "") : "";
}

export async function dataUrlToFile(
  dataUrl: string,
  name = "pasted-image.jpg",
): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

export async function blobUrlToFile(
  blobUrl: string,
  name = "pasted-image.jpg",
): Promise<File> {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

export function noteImgPlaceholder(index: number): string {
  return `<span data-note-img-placeholder="${index}"></span>`;
}

export async function prepareMixedPaste(
  html: string,
  clipboardFiles: File[],
): Promise<PrepareMixedPasteResult> {
  const fileQueue = [...clipboardFiles];
  const pending: PendingPasteImage[] = [];
  let placeholderIndex = 0;
  let skippedImages = 0;
  let rewritten = "";
  let lastIndex = 0;

  for (const match of Array.from(html.matchAll(IMG_TAG_RE))) {
    const full = match[0];
    const start = match.index ?? 0;
    const attrs = match[1] || "";
    const src = getImgAttr(attrs, "src");
    const alt = getImgAttr(attrs, "alt") || "pasted image";
    const kind = classifyImageSrc(src);

    let source: Promise<File> | null = null;
    if (kind === "data") {
      source = dataUrlToFile(src);
    } else if (kind === "blob") {
      source = blobUrlToFile(src);
    } else if (fileQueue.length) {
      source = Promise.resolve(fileQueue.shift()!);
    }

    rewritten += html.slice(lastIndex, start);
    lastIndex = start + full.length;

    if (!source) {
      skippedImages += 1;
      continue;
    }

    const index = placeholderIndex;
    placeholderIndex += 1;
    pending.push({ index, alt, source });
    rewritten += noteImgPlaceholder(index);
  }

  rewritten += html.slice(lastIndex);
  return { html: rewritten, pending, skippedImages };
}
