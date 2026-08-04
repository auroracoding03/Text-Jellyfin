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
});
