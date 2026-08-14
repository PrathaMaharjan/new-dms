import { resetPassword } from "@/controller/password-reset/controller";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await resetPassword(body);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, statusCode: 200, message: "Password has been reset successfully." });
}
