import { NextRequest, NextResponse } from "next/server";
import { isBasicAuthValid } from "@/lib/security/basic-auth";

function challenge(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Text Jellyfin", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export function middleware(request: NextRequest) {
  const username = process.env.AUTH_USERNAME?.trim() || "";
  const password = process.env.AUTH_PASSWORD || "";

  if (!username && !password) return NextResponse.next();
  if (!username || !password) {
    return new NextResponse("Authentication is misconfigured.", { status: 503 });
  }

  return isBasicAuthValid(request.headers.get("authorization"), username, password)
    ? NextResponse.next()
    : challenge();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
