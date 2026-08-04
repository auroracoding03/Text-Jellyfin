import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDocumentById } from "@/lib/catalog/queries";
import { resolveCacheAsset } from "@/lib/ingest/cache";
import { assertRealPathWithinRoot } from "@/lib/security/paths";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string; filename: string } },
) {
  const document = getDocumentById(params.id);
  if (!document || !document.cacheKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assetPath = resolveCacheAsset(
    document.id,
    document.cacheKey,
    params.filename,
  );
  if (!assetPath) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  try {
    const safePath = assertRealPathWithinRoot(config.cachePath, assetPath);
    const data = fs.readFileSync(safePath);
    const ext = path.extname(safePath).toLowerCase();
    return new NextResponse(data, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
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
