import grayMatter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { sanitizeArticleHtml } from "@/lib/security/sanitize";
import {
  ADAPTER_VERSIONS,
  type AdapterAsset,
  type AdapterContext,
  type AdapterResult,
  type FormatAdapter,
} from "@/lib/ingest/types";
import { parseNoteAssetFilename } from "@/lib/notes/asset-refs";
import {
  detectImageContentType,
  noteAssetsDirFor,
} from "@/lib/notes/assets";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

async function markdownToHtml(markdown: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);
  return sanitizeArticleHtml(String(file));
}

function attachLocalNoteAssets(
  html: string,
  markdownPath: string,
  assetBaseUrl: string,
): { html: string; assets: AdapterAsset[]; warnings: string[] } {
  const assets: AdapterAsset[] = [];
  const warnings: string[] = [];
  const stem = path.basename(markdownPath, path.extname(markdownPath));
  const seen = new Set<string>();

  const htmlOut = html.replace(/<img\b([^>]*?)>/gi, (full, attrs: string) => {
    const srcMatch = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    if (!srcMatch) return full;
    const rawSrc = srcMatch[1] ?? srcMatch[2] ?? "";
    if (/^(https?:|data:|mailto:)/i.test(rawSrc.trim())) return full;

    const filename = parseNoteAssetFilename(rawSrc, stem);
    if (!filename) {
      warnings.push("Skipped an image that is not a note asset.");
      return "";
    }

    if (!seen.has(filename)) {
      const assetPath = path.join(noteAssetsDirFor(markdownPath), filename);
      try {
        if (!fs.existsSync(assetPath)) {
          warnings.push(`Missing note image ${filename}.`);
          return "";
        }
        const data = fs.readFileSync(assetPath);
        const contentType =
          detectImageContentType(data) || "application/octet-stream";
        assets.push({ filename, contentType, data });
        seen.add(filename);
      } catch {
        warnings.push(`Could not read note image ${filename}.`);
        return "";
      }
    }

    const nextSrc = `${assetBaseUrl}/${filename}`;
    const newAttrs = attrs.replace(srcMatch[0], `src="${nextSrc}"`);
    return `<img${newAttrs}>`;
  });

  return { html: htmlOut, assets, warnings };
}

export const markdownAdapter: FormatAdapter = {
  name: "markdown",
  version: ADAPTER_VERSIONS.markdown,
  formats: ["md"],
  async extract(ctx: AdapterContext): Promise<AdapterResult> {
    const raw = await fsp.readFile(ctx.absolutePath, {
      encoding: "utf8",
      signal: ctx.signal,
    });
    const { data, content } = grayMatter(raw);
    const sanitized = await markdownToHtml(content);
    const attached = attachLocalNoteAssets(
      sanitized,
      ctx.absolutePath,
      ctx.assetBaseUrl,
    );
    const plainText = content.replace(/[#>*_`\[\]()!-]/g, " ").replace(/\s+/g, " ").trim();

    const tags = Array.isArray(data.tags)
      ? data.tags.filter((tag: unknown) => typeof tag === "string")
      : typeof data.tags === "string"
        ? data.tags.split(",").map((tag: string) => tag.trim())
        : [];

    return {
      metadata: {
        title: typeof data.title === "string" ? data.title : undefined,
        summary: typeof data.summary === "string" ? data.summary : undefined,
        author: typeof data.author === "string" ? data.author : undefined,
        series: typeof data.series === "string" ? data.series : undefined,
        chapter:
          typeof data.chapter === "number" && Number.isFinite(data.chapter)
            ? Math.floor(data.chapter)
            : typeof data.chapter === "string" && /^\d+$/.test(data.chapter.trim())
              ? Number(data.chapter.trim())
              : undefined,
        language: typeof data.language === "string" ? data.language : undefined,
        tags,
      },
      plainText,
      html: attached.html,
      assets: attached.assets,
      status: attached.warnings.length ? "warning" : "ready",
      warnings: attached.warnings.slice(0, 8),
    };
  },
};
