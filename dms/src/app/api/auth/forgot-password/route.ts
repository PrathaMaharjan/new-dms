import { requestPasswordResetOtp } from "@/controller/password-reset/controller";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await requestPasswordResetOtp(body);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    message: "If an account exists with this email, a reset code has been sent.",
  });
}