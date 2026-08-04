import { NextResponse } from "next/server";
import { wipeServerData } from "@/lib/server/delete-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const result = wipeServerData();
    return NextResponse.json({
      ok: true,
      message:
        "Server data deleted. Library files and uploads were left on disk.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to delete server data.",
      },
      { status: 500 },
    );
  }
}
