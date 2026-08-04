import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getDocumentById } from "@/lib/catalog/queries";
import { assertWithinRoot } from "@/lib/security/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const data = fs.readFileSync(absolutePath);
    const filename = path.basename(absolutePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read original" },
      { status: 400 },
    );
  }
}
