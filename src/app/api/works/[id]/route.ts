import { NextResponse } from "next/server";
import { deleteDocument, DocumentDeleteError } from "@/lib/catalog/delete-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = deleteDocument(params.id);
    return NextResponse.json({
      ok: true,
      message: "Removed from the library.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to delete this item.",
      },
      { status: error instanceof DocumentDeleteError ? 404 : 500 },
    );
  }
}
