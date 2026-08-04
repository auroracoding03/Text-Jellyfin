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
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(typeof body.summary === "string" ? { summary: body.summary } : {}),
      ...(typeof body.author === "string" ? { author: body.author } : {}),
      ...(typeof body.series === "string" ? { series: body.series } : {}),
      ...(typeof body.language === "string" ? { language: body.language } : {}),
      ...(Array.isArray(body.tags)
        ? { tags: body.tags.map((tag: unknown) => String(tag)) }
        : {}),
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
