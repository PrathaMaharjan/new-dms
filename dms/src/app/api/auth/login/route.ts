import { loginController } from "@/controller/auth/controller";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const ACCESS_TOKEN_MAX_AGE_SECONDS = 604800;
  const body = await request.json().catch(() => null);
  const result = await loginController(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const response = NextResponse.json({
    success: true,
    statusCode: 200,
    data: result,
  });

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
