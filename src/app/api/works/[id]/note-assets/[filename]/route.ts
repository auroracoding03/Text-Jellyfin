import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { canEditContent } from "@/lib/catalog/content-actions";
import { getDocumentById } from "@/lib/catalog/queries";
import { config } from "@/lib/config";
import {
  NOTE_ASSET_CONTENT_TYPES,
  resolveSourceNoteAsset,
} from "@/lib/notes/assets";
import { assertRealPathWithinRoot } from "@/lib/security/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; filename: string } },
) {
  const document = getDocumentById(params.id);
  if (!document || !canEditContent(document) || document.format !== "md") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const markdownPath = path.join(config.libraryPath, document.relativePath);
  const assetPath = resolveSourceNoteAsset(markdownPath, params.filename);
  if (!assetPath) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  try {
    const safePath = assertRealPathWithinRoot(config.libraryPath, assetPath);
    const data = fs.readFileSync(safePath);
    const ext = path.extname(safePath).toLowerCase();
    return new NextResponse(data, {
      headers: {
        "Content-Type": NOTE_ASSET_CONTENT_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read asset" },
      { status: 400 },
    );
  }
}
