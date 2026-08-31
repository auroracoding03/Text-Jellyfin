import { NextResponse } from "next/server";
import { imagesFromFormData } from "@/lib/notes/assets";
import { coverFromFormData } from "@/lib/catalog/cover";
import {
  exceedsNotePayloadLimit,
  notePayloadLimitError,
} from "@/lib/notes/payload-limits";
import { UploadError, uploadFile, uploadText } from "@/lib/uploads/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (exceedsNotePayloadLimit(contentLength)) {
    return NextResponse.json({ error: notePayloadLimitError() }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const kind = formData.get("kind");
    const title = String(formData.get("title") || "");
    const summary = String(formData.get("summary") || "");
    const author = String(formData.get("author") || "");
    const series = String(formData.get("series") || "");
    const chapter = String(formData.get("chapter") || "");
    const tags = String(formData.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const images = await imagesFromFormData(formData);
    const coverValue = await coverFromFormData(formData);
    const cover = coverValue && coverValue !== "clear" ? coverValue : undefined;

    const result =
      kind === "text"
        ? await uploadText({
            title,
            format: String(formData.get("format") || "txt"),
            text: String(formData.get("text") || ""),
            summary,
            author,
            series,
            chapter,
            tags,
            images,
            cover,
          })
        : await uploadFromFile(
            formData.get("file"),
            title,
            summary,
            author,
            series,
            chapter,
            tags,
            cover,
          );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const status = error instanceof UploadError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to process upload.",
      },
      { status },
    );
  }
}

async function uploadFromFile(
  value: FormDataEntryValue | null,
  title: string,
  summary: string,
  author: string,
  series: string,
  chapter: string,
  tags: string[],
  cover?: Buffer,
) {
  if (!value || typeof value === "string" || typeof value.arrayBuffer !== "function") {
    throw new UploadError("Choose a Markdown or plain-text file to upload.");
  }
  const filename =
    "name" in value && typeof value.name === "string" && value.name
      ? value.name
      : "upload.txt";
  return uploadFile({
    filename,
    content: Buffer.from(await value.arrayBuffer()),
    title,
    summary,
    author,
    series,
    chapter,
    tags,
    cover,
  });
}
