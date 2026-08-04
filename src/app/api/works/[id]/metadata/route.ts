import { NextResponse } from "next/server";
import { updateDocumentMetadata } from "@/lib/catalog/metadata-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    await updateDocumentMetadata(params.id, {
      title: String(body.title || ""),
      summary: String(body.summary || ""),
      author: String(body.author || ""),
      series: String(body.series || ""),
      language: String(body.language || ""),
      tags: Array.isArray(body.tags)
        ? body.tags.map((tag: unknown) => String(tag))
        : [],
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update metadata",
      },
      { status: 400 },
    );
  }
}
