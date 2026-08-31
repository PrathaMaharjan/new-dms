import { requestPatientVerificationCode } from "@/controller/patient portal/controller";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await requestPatientVerificationCode(body);
  if (!result.success) {
    const status = result.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ success: false, error: result.error }, { status });
  }
  return NextResponse.json({ success: true, data: {} });
}