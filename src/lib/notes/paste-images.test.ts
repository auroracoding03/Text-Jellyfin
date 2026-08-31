import { describe, expect, it } from "vitest";
import {
  classifyClipboardPaste,
  classifyImageSrc,
  noteImgPlaceholder,
  prepareMixedPaste,
} from "@/lib/notes/paste-images";

describe("paste image helpers", () => {
  it("classifies image-only, mixed, and plain paste", () => {
    expect(
      classifyClipboardPaste({ imageFiles: [new File([], "a.png", { type: "image/png" })] }),
    ).toBe("image-only");
    expect(
      classifyClipboardPaste({
        html: "<p>Story</p><img src='file:///tmp/a.png'>",
        imageFiles: [new File([], "a.png", { type: "image/png" })],
      }),
    ).toBe("mixed");
    expect(classifyClipboardPaste({ plain: "Just text" })).toBe("none");
  });

  it("classifies image src kinds", () => {
    expect(classifyImageSrc("data:image/png;base64,abc")).toBe("data");
    expect(classifyImageSrc("blob:http://localhost/1")).toBe("blob");
    expect(classifyImageSrc("file:///C:/Users/pic.png")).toBe("file");
    expect(classifyImageSrc("https://example.com/a.jpg")).toBe("remote");
    expect(classifyImageSrc("")).toBe("empty");
  });

  it("removes file and remote images while keeping story html", async () => {
    const result = await prepareMixedPaste(
      '<p>Hello</p><img src="file:///C:/pic.png"><img src="https://x.test/a.jpg">',
      [],
    );

    expect(result.html).toContain("<p>Hello</p>");
    expect(result.html).not.toContain("<img");
    expect(result.pending).toHaveLength(0);
    expect(result.skippedImages).toBe(2);
  });

  it("pairs clipboard files with file:// images from Word", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "word.png", {
      type: "image/png",
    });
    const result = await prepareMixedPaste(
      '<p>Story</p><img alt="scene" src="file:///C:/Users/AppData/Local/Temp/mso1234.png">',
      [file],
    );

    expect(result.html).toContain(noteImgPlaceholder(0));
    expect(result.pending).toHaveLength(1);
    await expect(result.pending[0]?.source).resolves.toBe(file);
    expect(result.skippedImages).toBe(0);
  });

  it("handles duplicate img tags independently", async () => {
    const file = new File([new Uint8Array([1])], "a.png", { type: "image/png" });
    const tag = '<img alt="dup" src="file:///C:/a.png">';
    const result = await prepareMixedPaste(`<p>x</p>${tag}${tag}`, [file, file]);

    expect(result.html).toContain(noteImgPlaceholder(0));
    expect(result.html).toContain(noteImgPlaceholder(1));
    expect(result.pending).toHaveLength(2);
  });

  it("pairs clipboard files with inline images that have no src", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "clip.png", {
      type: "image/png",
    });
    const result = await prepareMixedPaste('<p>Story</p><img alt="scene">', [file]);

    expect(result.html).toContain("<p>Story</p>");
    expect(result.html).toContain(noteImgPlaceholder(0));
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0]?.alt).toBe("scene");
    await expect(result.pending[0]?.source).resolves.toBe(file);
    expect(result.skippedImages).toBe(0);
  });

  it("harvests data-url images from mixed html", async () => {
    const dataUrl =
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/Z";
    const result = await prepareMixedPaste(`<p>Hi</p><img alt="inline" src="${dataUrl}">`, []);

    expect(result.html).toContain(noteImgPlaceholder(0));
    expect(result.pending).toHaveLength(1);
    const harvested = await result.pending[0]!.source;
    expect(harvested.type).toMatch(/^image\//);
    expect(result.skippedImages).toBe(0);
  });
});
