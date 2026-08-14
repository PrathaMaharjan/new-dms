import { verifyPasswordResetOtp } from "@/controller/password-reset/controller";
import { NextRequest, NextResponse } from "next/server";
// import { verifyPasswordResetOtp } from "@/lib/controllers/password-reset.controller";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await verifyPasswordResetOtp(body);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { resetToken: result.resetToken } });
}