import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertWithinRoot, toPosixRelative } from "@/lib/security/paths";
import { escapeHtml, sanitizeArticleHtml } from "@/lib/security/sanitize";
import {
  mergeMetadata,
  summaryFromText,
  titleFromFilename,
} from "@/lib/ingest/metadata";

describe("path security", () => {
  it("allows nested paths under root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tj-root-"));
    const nested = path.join(root, "notes", "a.md");
    fs.mkdirSync(path.dirname(nested), { recursive: true });
    fs.writeFileSync(nested, "x");
    const result = assertWithinRoot(root, nested);
    expect(result).toBe(path.resolve(nested));
  });

  it("rejects path traversal", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tj-root-"));
    expect(() =>
      assertWithinRoot(root, path.join(root, "..", "secrets.txt")),
    ).toThrow(/escapes root/i);
  });

  it("normalizes relative paths to posix", () => {
    const root = path.resolve("library-root");
    const file = path.join(root, "a", "b.txt");
    expect(toPosixRelative(root, file)).toBe("a/b.txt");
  });
});

describe("sanitize", () => {
  it("strips scripts and event handlers", () => {
    const html = sanitizeArticleHtml(
      `<p onclick="alert(1)">Hello</p><script>alert(2)</script><a href="javascript:alert(3)">x</a>`,
    );
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("Hello");
  });

  it("escapes plain text", () => {
    expect(escapeHtml(`<b>&"'`)).toBe("&lt;b&gt;&amp;&quot;&#39;");
  });
});

describe("metadata helpers", () => {
  it("builds titles and summaries", () => {
    expect(titleFromFilename("my-cool-note.md")).toBe("My Cool Note");
    expect(summaryFromText("alpha ".repeat(100)).endsWith("…")).toBe(true);
  });

  it("prefers sidecar over embedded metadata", () => {
    const merged = mergeMetadata(
      "doc.pdf",
      { title: "Sidecar Title", tags: ["a"] },
      { title: "Embedded", tags: ["b"], author: "Ada" },
      "Body text for summary fallback.",
    );
    expect(merged.title).toBe("Sidecar Title");
    expect(merged.author).toBe("Ada");
    expect(merged.tags).toEqual(["a", "b"]);
  });
});
