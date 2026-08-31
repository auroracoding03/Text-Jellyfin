import { describe, expect, it } from "vitest";
import {
  normalizePastedHtml,
  normalizePastedText,
} from "@/lib/notes/normalize-pasted-text";

describe("normalize pasted text", () => {
  it("maps Word punctuation and removes replacement characters", () => {
    const input = "“Hello” — it\u2019s fine\u2026\uFFFD";
    expect(normalizePastedText(input)).toBe('"Hello" -- it\'s fine...');
  });

  it("keeps accented characters", () => {
    expect(normalizePastedText("café résumé")).toBe("café résumé");
  });

  it("normalizes nbsp and html entities in plain text", () => {
    expect(normalizePastedText("wait&nbsp;&mdash;go&#8217;")).toBe("wait --go'");
  });

  it("leaves img src data urls untouched in html", () => {
    const html =
      '<p>&ldquo;Hi&rdquo;</p><img src="data:image/png;base64,abc" alt="x">';
    expect(normalizePastedHtml(html)).toBe(
      '<p>"Hi"</p><img src="data:image/png;base64,abc" alt="x">',
    );
  });
});
