import grayMatter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { sanitizeArticleHtml } from "@/lib/security/sanitize";
import {
  ADAPTER_VERSIONS,
  type AdapterContext,
  type AdapterResult,
  type FormatAdapter,
} from "@/lib/ingest/types";
import fs from "node:fs/promises";

async function markdownToHtml(markdown: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);
  return sanitizeArticleHtml(String(file));
}

export const markdownAdapter: FormatAdapter = {
  name: "markdown",
  version: ADAPTER_VERSIONS.markdown,
  formats: ["md"],
  async extract(ctx: AdapterContext): Promise<AdapterResult> {
    const raw = await fs.readFile(ctx.absolutePath, "utf8");
    const { data, content } = grayMatter(raw);
    const html = await markdownToHtml(content);
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
        language: typeof data.language === "string" ? data.language : undefined,
        tags,
      },
      plainText,
      html,
      assets: [],
      status: "ready",
      warnings: [],
    };
  },
};
