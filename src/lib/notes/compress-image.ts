export const CLIENT_IMAGE_MAX_WIDTH = 1600;
export const CLIENT_IMAGE_MAX_HEIGHT = 1600;
export const CLIENT_IMAGE_JPEG_QUALITY = 0.8;
export const CLIENT_MAX_NOTE_IMAGE_BYTES = 1024 * 1024;
export const CLIENT_MAX_NOTE_IMAGES = 15;

const QUALITY_STEPS = [0.8, 0.6, 0.4] as const;
const MAX_EDGE_STEPS = [1600, 1200, 800] as const;

export type CompressImageOptions = {
  maxBytes?: number;
  crop?: "center-square";
};

type DrawableSource = ImageBitmap | HTMLImageElement;

function scaleDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (width <= maxEdge && height <= maxEdge) {
    return { width, height };
  }
  if (width > height) {
    return {
      width: maxEdge,
      height: Math.max(1, Math.round((height * maxEdge) / width)),
    };
  }
  return {
    width: Math.max(1, Math.round((width * maxEdge) / height)),
    height: maxEdge,
  };
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (event) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read this image."));
      img.src = String(event.target?.result ?? "");
    };
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}

async function loadDrawableSource(file: File): Promise<DrawableSource> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall back to HTMLImageElement when createImageBitmap is unavailable.
    }
  }
  return loadHtmlImage(file);
}

function closeDrawableSource(source: DrawableSource): void {
  if ("close" in source && typeof source.close === "function") {
    source.close();
  }
}

function encodeJpeg(
  source: DrawableSource,
  width: number,
  height: number,
  quality: number,
  crop?: { sx: number; sy: number; sw: number; sh: number },
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not compress this image."));
      return;
    }
    if (crop) {
      ctx.drawImage(source, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
    } else {
      ctx.drawImage(source, 0, 0, width, height);
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress this image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Only JPEG, PNG, WebP, and GIF images are supported.");
  }

  const maxBytes = options.maxBytes ?? CLIENT_MAX_NOTE_IMAGE_BYTES;
  const source = await loadDrawableSource(file);
  const crop =
    options.crop === "center-square"
      ? (() => {
          const size = Math.min(source.width, source.height);
          return {
            sx: Math.floor((source.width - size) / 2),
            sy: Math.floor((source.height - size) / 2),
            sw: size,
            sh: size,
          };
        })()
      : undefined;
  const sourceWidth = crop?.sw ?? source.width;
  const sourceHeight = crop?.sh ?? source.height;

  try {
    for (const maxEdge of MAX_EDGE_STEPS) {
      const { width, height } = scaleDimensions(sourceWidth, sourceHeight, maxEdge);
      for (const quality of QUALITY_STEPS) {
        const blob = await encodeJpeg(source, width, height, quality, crop);
        if (blob.size <= maxBytes) {
          return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
        }
      }
    }
  } finally {
    closeDrawableSource(source);
  }

  throw new Error(
    `Each image must be ${Math.ceil(maxBytes / 1024)} KB or smaller after compression.`,
  );
}
