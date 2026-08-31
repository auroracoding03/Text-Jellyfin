export const CLIENT_IMAGE_MAX_WIDTH = 1600;
export const CLIENT_IMAGE_MAX_HEIGHT = 1600;
export const CLIENT_IMAGE_JPEG_QUALITY = 0.8;
export const CLIENT_MAX_NOTE_IMAGE_BYTES = 1024 * 1024;
export const CLIENT_MAX_NOTE_IMAGES = 15;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Only JPEG, PNG, WebP, and GIF images are supported.");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > CLIENT_IMAGE_MAX_WIDTH || height > CLIENT_IMAGE_MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * CLIENT_IMAGE_MAX_WIDTH) / width);
            width = CLIENT_IMAGE_MAX_WIDTH;
          } else {
            width = Math.round((width * CLIENT_IMAGE_MAX_HEIGHT) / height);
            height = CLIENT_IMAGE_MAX_HEIGHT;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not compress this image."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Could not compress this image."));
              return;
            }
            resolve(
              new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now(),
              }),
            );
          },
          "image/jpeg",
          CLIENT_IMAGE_JPEG_QUALITY,
        );
      };
      img.onerror = () => reject(new Error("Could not read this image."));
      img.src = String(event.target?.result ?? "");
    };
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}
