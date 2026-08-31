import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { textAdapter } from "@/lib/ingest/adapters/text";
import { markdownAdapter } from "@/lib/ingest/adapters/markdown";

describe("adapters", () => {
  it("converts plain text into paragraphs", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-text-"));
    const file = path.join(dir, "sample.txt");
    fs.writeFileSync(file, "Hello world.\n\nSecond paragraph.");

    const result = await textAdapter.extract({
      absolutePath: file,
      relativePath: "sample.txt",
      format: "txt",
      contentHash: "abc",
      assetBaseUrl: "/assets",
    });

    expect(result.status).toBe("ready");
    expect(result.html).toContain("<p>");
    expect(result.plainText).toContain("Second paragraph");
  });

  it("renders markdown with frontmatter metadata", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-md-"));
    const file = path.join(dir, "sample.md");
    fs.writeFileSync(
      file,
      `---
title: Demo
summary: A demo note
tags: [demo]
---

# Heading

Paragraph with **bold**.
`,
    );

    const result = await markdownAdapter.extract({
      absolutePath: file,
      relativePath: "sample.md",
      format: "md",
      contentHash: "abc",
      assetBaseUrl: "/assets",
    });

    expect(result.metadata.title).toBe("Demo");
    expect(result.metadata.tags).toEqual(["demo"]);
    expect(result.html).toContain("<h1>");
    expect(result.html).toContain("<strong>");
  });

  it("copies local note-assets into adapter assets and rewrites src", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tj-md-img-"));
    const file = path.join(dir, "sample.md");
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x01]);
    fs.mkdirSync(path.join(dir, "sample.assets"));
    fs.writeFileSync(path.join(dir, "sample.assets", "tiny.jpg"), jpeg);
    fs.writeFileSync(path.join(dir, "escape.jpg"), jpeg);
    fs.writeFileSync(
      file,
      `# Illustrated

![ok](note-assets/tiny.jpg)

![bad](../escape.jpg)
`,
    );

    const result = await markdownAdapter.extract({
      absolutePath: file,
      relativePath: "sample.md",
      format: "md",
      contentHash: "abc",
      assetBaseUrl: "/assets",
    });

    expect(result.html).toContain('src="/assets/tiny.jpg"');
    expect(result.html).not.toContain("../escape.jpg");
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.filename).toBe("tiny.jpg");
    expect(result.assets[0]?.data.equals(jpeg)).toBe(true);
  });
});
