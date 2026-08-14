import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./lib/auth/tokens";

export function proxy(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;
  const session = accessToken ? verifyAccessToken(accessToken) : null;

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {

  matcher: ["/t/:path*"],
};