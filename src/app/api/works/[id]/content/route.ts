import { NextResponse } from "next/server";
import { ContentEditError, updateDocumentContent } from "@/lib/catalog/content-actions";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    if (typeof body.content !== "string") {
      return NextResponse.json({ error: "Article text is required." }, { status: 400 });
    }
    await updateDocumentContent(params.id, body.content);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update article text." },
      { status: error instanceof ContentEditError ? 400 : 500 },
    );
  }
}
