import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const library = path.join(process.cwd(), "fixtures", "library");
fs.mkdirSync(library, { recursive: true });

async function writeDocx() {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels")?.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.folder("word")?.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Readable Word Sample</w:t></w:r></w:p>
    <w:p><w:r><w:t>This DOCX fixture demonstrates native article conversion for Word documents.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Headings and paragraphs should survive Mammoth conversion and HTML sanitization.</w:t></w:r></w:p>
  </w:body>
</w:document>`,
  );
  zip.folder("word")?.folder("_rels")?.file(
    "document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(path.join(library, "readable-word-sample.docx"), buffer);
  fs.writeFileSync(
    path.join(library, "readable-word-sample.docx.meta.yaml"),
    `title: Readable Word Sample
summary: A DOCX fixture converted into a native article.
tags:
  - sample
  - docx
author: Text Jellyfin
`,
  );
}

function writePdf() {
  const stream = `BT /F1 18 Tf 72 720 Td (Sample PDF Article) Tj 0 -28 Td (This PDF has an extractable text layer.) Tj 0 -28 Td (Text Jellyfin should render it as an article.) Tj ET`;
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n",
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += object;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  fs.writeFileSync(path.join(library, "sample-pdf-article.pdf"), pdf, "utf8");
  fs.writeFileSync(
    path.join(library, "sample-pdf-article.pdf.meta.yaml"),
    `title: Sample PDF Article
summary: A text-layer PDF fixture for native article extraction.
tags:
  - sample
  - pdf
`,
  );
}

async function main() {
  await writeDocx();
  writePdf();
  console.log("Fixtures written");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
