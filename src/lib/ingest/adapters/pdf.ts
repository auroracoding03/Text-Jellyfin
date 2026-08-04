import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { escapeHtml, sanitizeArticleHtml } from "@/lib/security/sanitize";
import {
  ADAPTER_VERSIONS,
  type AdapterContext,
  type AdapterResult,
  type FormatAdapter,
} from "@/lib/ingest/types";

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

function reconstructPageText(items: TextItem[]): { text: string; suspicious: boolean } {
  if (!items.length) {
    return { text: "", suspicious: false };
  }

  const sorted = [...items].sort((a, b) => {
    const ay = a.transform[5] ?? 0;
    const by = b.transform[5] ?? 0;
    if (Math.abs(ay - by) > 2) return by - ay;
    return (a.transform[4] ?? 0) - (b.transform[4] ?? 0);
  });

  const lines: string[] = [];
  let currentY = sorted[0].transform[5] ?? 0;
  let currentLine: TextItem[] = [];
  let jumpCount = 0;
  let previousY = currentY;

  const flush = () => {
    if (!currentLine.length) return;
    const line = currentLine
      .map((item, index) => {
        const previous = currentLine[index - 1];
        if (!previous) return item.str;
        const gap =
          (item.transform[4] ?? 0) -
          ((previous.transform[4] ?? 0) + (previous.width || 0));
        const space = gap > Math.max(1.5, (previous.width || 4) * 0.15) ? " " : "";
        return `${space}${item.str}`;
      })
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (line) lines.push(line);
    currentLine = [];
  };

  for (const item of sorted) {
    const y = item.transform[5] ?? 0;
    if (Math.abs(y - currentY) > 2.5) {
      if (previousY - y < -8) jumpCount += 1;
      flush();
      currentY = y;
    }
    currentLine.push(item);
    previousY = y;
  }
  flush();

  return {
    text: lines.join("\n"),
    suspicious: jumpCount > Math.max(3, Math.floor(lines.length / 8)),
  };
}

export const pdfAdapter: FormatAdapter = {
  name: "pdf",
  version: ADAPTER_VERSIONS.pdf,
  formats: ["pdf"],
  async extract(ctx: AdapterContext): Promise<AdapterResult> {
    const data = new Uint8Array(await fs.readFile(ctx.absolutePath));

    // pdfjs-dist v4 Node entry
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const workerPath = pathToFileURL(
      path.join(
        process.cwd(),
        "node_modules",
        "pdfjs-dist",
        "legacy",
        "build",
        "pdf.worker.mjs",
      ),
    ).href;
    pdfjs.GlobalWorkerOptions.workerSrc = workerPath;

    const loadingTask = pdfjs.getDocument({
      data,
      isEvalSupported: false,
      useSystemFonts: true,
      verbosity: 0,
    });
    const doc = await loadingTask.promise;
    const warnings: string[] = [];
    const pageHtml: string[] = [];
    const pageText: string[] = [];
    let totalChars = 0;
    let suspiciousPages = 0;

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = (content.items as TextItem[]).filter(
        (item) => typeof item.str === "string" && item.str.trim(),
      );
      const reconstructed = reconstructPageText(items);
      if (reconstructed.suspicious) suspiciousPages += 1;
      totalChars += reconstructed.text.replace(/\s+/g, "").length;

      if (reconstructed.text.trim()) {
        pageText.push(reconstructed.text);
        const paragraphs = reconstructed.text
          .split(/\n{2,}|\n(?=[A-Z])/)
          .map((part) => part.trim())
          .filter(Boolean);
        pageHtml.push(
          `<section class="pdf-page" data-page="${pageNumber}"><p class="page-marker">Page ${pageNumber}</p>${paragraphs
            .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
            .join("\n")}</section>`,
        );
      }
    }

    if (!totalChars) {
      return {
        metadata: {},
        plainText: "",
        html: "",
        assets: [],
        status: "needs_ocr",
        warnings: [
          "No extractable text layer found. This PDF may be scanned and needs OCR.",
        ],
      };
    }

    const fileStat = await fs.stat(ctx.absolutePath);
    const density = totalChars / Math.max(fileStat.size, 1);
    if (density < 0.0004) {
      warnings.push(
        "Very low text density relative to file size. Extraction may be incomplete.",
      );
    }
    if (suspiciousPages > 0) {
      warnings.push(
        `Reading order may be imperfect on ${suspiciousPages} page(s), especially for multi-column layouts.`,
      );
    }

    return {
      metadata: {},
      plainText: pageText.join("\n\n"),
      html: sanitizeArticleHtml(pageHtml.join("\n")),
      assets: [],
      status: warnings.length ? "warning" : "ready",
      warnings,
    };
  },
};
