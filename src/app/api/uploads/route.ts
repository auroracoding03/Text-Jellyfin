import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { UploadError, uploadFile, uploadText } from "@/lib/uploads/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORM_OVERHEAD_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > config.maxUploadBytes + FORM_OVERHEAD_BYTES) {
    return NextResponse.json(
      { error: `Upload exceeds the ${config.maxUploadBytes} byte upload limit.` },
      { status: 413 },
    );
  }

  try {
    const formData = await request.formData();
    const kind = formData.get("kind");
    const title = String(formData.get("title") || "");
    const tags = String(formData.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const result =
      kind === "text"
        ? await uploadText({
            title,
            format: String(formData.get("format") || "txt"),
            text: String(formData.get("text") || ""),
            summary: String(formData.get("summary") || ""),
            tags,
          })
        : await uploadFromFile(
            formData.get("file"),
            title,
            String(formData.get("summary") || ""),
            tags,
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
  tags: string[],
) {
  if (!(value instanceof File)) {
    throw new UploadError("Choose a Markdown or plain-text file to upload.");
  }
  return uploadFile({
    filename: value.name,
    content: Buffer.from(await value.arrayBuffer()),
    title,
    summary,
    tags,
  });
}
