import { NextResponse } from "next/server";
import {
  ContentEditError,
  updateDocumentContent,
} from "@/lib/catalog/content-actions";
import { imagesFromFormData } from "@/lib/notes/assets";
import {
  exceedsNotePayloadLimit,
  notePayloadLimitError,
} from "@/lib/notes/payload-limits";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (exceedsNotePayloadLimit(contentLength)) {
    return NextResponse.json({ error: notePayloadLimitError() }, { status: 413 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let content: string;
    let images = [] as Awaited<ReturnType<typeof imagesFromFormData>>;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      content = String(formData.get("content") || "");
      images = await imagesFromFormData(formData);
    } else {
      const body = await request.json();
      if (typeof body.content !== "string") {
        return NextResponse.json({ error: "Article text is required." }, { status: 400 });
      }
      content = body.content;
    }

    if (typeof content !== "string") {
      return NextResponse.json({ error: "Article text is required." }, { status: 400 });
    }

    await updateDocumentContent(params.id, content, images);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update article text." },
      { status: error instanceof ContentEditError ? error.status : 500 },
    );
  }
}
