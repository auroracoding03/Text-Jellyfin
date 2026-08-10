import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";
import { createHealthIdentity } from "@/lib/server/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    createHealthIdentity(
      process.env.TEXT_JELLYFIN_VERSION || packageJson.version,
      process.env.TEXT_JELLYFIN_SERVICE === "1",
    ),
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
