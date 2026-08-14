import { refreshController } from "@/controller/auth/controller";
import { NextRequest, NextResponse } from "next/server";

  const ACCESS_TOKEN_MAX_AGE_SECONDS = 604800;

export async function POST(request: NextRequest) {
  const rawRefreshToken = request.cookies.get("refresh_token")?.value;
  const result = await refreshController(rawRefreshToken);

  if (!result.success) {
    const response = NextResponse.json(
      { success: false, statusCode: 401, error: result.error },
      { status: 401 }
    );
    response.cookies.delete("access_token");
    response.cookies.delete("refresh_token");
    return response;
  }

  const response = NextResponse.json({ success: true, statusCode: 200, data: {} });

  response.cookies.set("access_token", result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });

  response.cookies.set("refresh_token", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: result.refreshTokenExpiresAt,
  });

  return response;
}