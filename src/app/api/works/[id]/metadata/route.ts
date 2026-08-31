import { NextResponse } from "next/server";
import { coverFromFormData } from "@/lib/catalog/cover";
import { updateDocumentMetadata } from "@/lib/catalog/metadata-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTags(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseChapter(value: FormDataEntryValue | null): number | null | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const chapter = Number(trimmed);
  return Number.isFinite(chapter) ? chapter : undefined;
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const cover = await coverFromFormData(formData);
      await updateDocumentMetadata(
        params.id,
        {
          ...(formData.has("title") ? { title: String(formData.get("title") || "") } : {}),
          ...(formData.has("summary")
            ? { summary: String(formData.get("summary") || "") }
            : {}),
          ...(formData.has("author") ? { author: String(formData.get("author") || "") } : {}),
          ...(formData.has("series") ? { series: String(formData.get("series") || "") } : {}),
          ...(formData.has("chapter") ? { chapter: parseChapter(formData.get("chapter")) } : {}),
          ...(formData.has("language")
            ? { language: String(formData.get("language") || "") }
            : {}),
          ...(formData.has("tags") ? { tags: parseTags(formData.get("tags")) } : {}),
        },
        cover,
      );
      return NextResponse.json({ ok: true });
    }

    const body = await request.json();
    await updateDocumentMetadata(params.id, {
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(typeof body.summary === "string" ? { summary: body.summary } : {}),
      ...(typeof body.author === "string" ? { author: body.author } : {}),
      ...(typeof body.series === "string" ? { series: body.series } : {}),
      ...(body.chapter === null
        ? { chapter: null }
        : typeof body.chapter === "number"
          ? { chapter: body.chapter }
          : typeof body.chapter === "string"
            ? {
                chapter: body.chapter.trim()
                  ? Number(body.chapter.trim())
                  : null,
              }
            : {}),
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
