import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getDocumentById } from "@/lib/catalog/queries";
import { assertRealPathWithinRoot, assertWithinRoot } from "@/lib/security/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function attachmentHeader(filename: string): string {
  const fallback = filename
    .replace(/[\r\n"]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const document = getDocumentById(params.id);
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const absolutePath = assertWithinRoot(
      config.libraryPath,
      path.join(config.libraryPath, document.relativePath),
    );
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: "Original missing" }, { status: 404 });
    }

    const safePath = assertRealPathWithinRoot(config.libraryPath, absolutePath);
    const filename = path.basename(safePath);
    const stream = Readable.toWeb(fs.createReadStream(safePath)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": attachmentHeader(filename),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read original" },
      { status: 400 },
    );
  }
}
