import fs from "node:fs/promises";
import { escapeHtml, sanitizeArticleHtml } from "@/lib/security/sanitize";
import {
  ADAPTER_VERSIONS,
  type AdapterContext,
  type AdapterResult,
  type FormatAdapter,
} from "@/lib/ingest/types";

function decodeText(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf8");
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le");
  }
  return buffer.toString("utf8");
}

export const textAdapter: FormatAdapter = {
  name: "text",
  version: ADAPTER_VERSIONS.text,
  formats: ["txt"],
  async extract(ctx: AdapterContext): Promise<AdapterResult> {
    const buffer = await fs.readFile(ctx.absolutePath, { signal: ctx.signal });
    const raw = decodeText(buffer).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const paragraphs = raw
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    const html = sanitizeArticleHtml(
      paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`).join("\n"),
    );

    return {
      metadata: {},
      plainText: raw.trim(),
      html,
      assets: [],
      status: "ready",
      warnings: [],
    };
  },
};
