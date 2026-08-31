import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveCoverPath } from "@/lib/catalog/cover";
import { getDocumentById } from "@/lib/catalog/queries";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const document = getDocumentById(params.id);
  if (!document?.hasCover) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sourcePath = path.join(config.libraryPath, document.relativePath);
  const coverPath = resolveCoverPath(sourcePath);
  if (!coverPath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = fs.readFileSync(coverPath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read cover" },
      { status: 400 },
    );
  }
}
