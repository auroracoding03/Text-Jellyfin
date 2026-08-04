import fs from "node:fs/promises";
import mammoth from "mammoth";
import { sanitizeArticleHtml } from "@/lib/security/sanitize";
import {
  ADAPTER_VERSIONS,
  type AdapterAsset,
  type AdapterContext,
  type AdapterResult,
  type FormatAdapter,
} from "@/lib/ingest/types";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const docxAdapter: FormatAdapter = {
  name: "docx",
  version: ADAPTER_VERSIONS.docx,
  formats: ["docx"],
  async extract(ctx: AdapterContext): Promise<AdapterResult> {
    const buffer = await fs.readFile(ctx.absolutePath);
    const assets: AdapterAsset[] = [];
    let imageIndex = 0;

    const result = await mammoth.convertToHtml(
      { buffer },
      {
        // Keep external file access disabled for safety.
        convertImage: mammoth.images.imgElement(async (image) => {
          const imageBuffer = Buffer.from(await image.read("base64"), "base64");
          const extension = (image.contentType.split("/")[1] || "png").replace(
            "jpeg",
            "jpg",
          );
          const filename = `image-${imageIndex++}.${extension}`;
          assets.push({
            filename,
            contentType: image.contentType,
            data: imageBuffer,
          });
          return {
            src: `${ctx.assetBaseUrl}/${filename}`,
          };
        }),
      },
    );

    const warnings = result.messages
      .map((message) => message.message)
      .filter(Boolean);

    const html = sanitizeArticleHtml(result.value);
    const plainText = stripHtml(html);

    return {
      metadata: {},
      plainText,
      html,
      assets,
      status: warnings.length ? "warning" : "ready",
      warnings: warnings.length
        ? warnings.slice(0, 8)
        : [],
    };
  },
};
