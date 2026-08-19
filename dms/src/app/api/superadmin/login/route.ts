// src/app/api/auth/superadmin/login/route.ts
import {
  platformAdminLoginController,
  SUPERADMIN_ACCESS_TOKEN_MAX_AGE_SECONDS,
} from "@/controller/superadmin/auth/controller";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const body = await request.json().catch(() => null);
  const result = await platformAdminLoginController(body, ip);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    success: true,
    statusCode: 200,
    data: { admin: result.admin },
  });

  response.cookies.set("platform_admin_access_token", result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SUPERADMIN_ACCESS_TOKEN_MAX_AGE_SECONDS,
  });

  response.cookies.set("platform_admin_refresh_token", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: result.refreshTokenExpiresAt,
  });

  return response;
}
