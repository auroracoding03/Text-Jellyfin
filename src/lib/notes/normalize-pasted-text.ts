const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

const PUNCTUATION_MAP: Record<string, string> = {
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "--",
  "\u2026": "...",
  "\u00A0": " ",
};

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: "\u00A0",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  ndash: "-",
  mdash: "--",
  hellip: "...",
  quot: '"',
  apos: "'",
  amp: "&",
  lt: "<",
  gt: ">",
};

function decodeNumericEntity(value: string, base: 10 | 16): string {
  const code = Number.parseInt(value, base);
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&([a-z]+);/gi, (full, name: string) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key)
        ? NAMED_ENTITIES[key]
        : full;
    })
    .replace(/&#(\d+);/g, (_full, code: string) => decodeNumericEntity(code, 10))
    .replace(/&#x([0-9a-f]+);/gi, (_full, code: string) =>
      decodeNumericEntity(code, 16),
    );
}

export function normalizePastedText(text: string): string {
  let normalized = decodeHtmlEntities(text.normalize("NFC"));
  normalized = normalized.replace(/\uFFFD/g, "");
  normalized = normalized.replace(ZERO_WIDTH_RE, "");
  normalized = normalized.replace(CONTROL_RE, "");
  for (const [from, to] of Object.entries(PUNCTUATION_MAP)) {
    normalized = normalized.replaceAll(from, to);
  }
  return normalized;
}

const IMG_TAG_SPLIT_RE = /(<img\b[^>]*>)/gi;

export function normalizePastedHtml(html: string): string {
  return html
    .split(IMG_TAG_SPLIT_RE)
    .map((part) => (/^<img\b/i.test(part) ? part : normalizePastedText(part)))
    .join("");
}
