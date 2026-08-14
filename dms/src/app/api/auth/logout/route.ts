import { logoutController } from "@/controller/auth/controller";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const rawRefreshToken = request.cookies.get("refresh_token")?.value;
  await logoutController(rawRefreshToken);

  const response = NextResponse.json({ success: true, statusCode: 200, data: {} });
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");
  return response;
}