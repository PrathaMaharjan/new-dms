// src/app/api/patient-auth/verify-code/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PATIENT_ACCESS_TOKEN_MAX_AGE_SECONDS } from "@/lib/auth/patient-tokens";
import { verifyPatientCode } from "@/controller/patient portal/controller";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await verifyPatientCode(body);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 401 });
  }

  const response = NextResponse.json({ success: true, data: { patient: result.patient } });

  response.cookies.set("patient_access_token", result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PATIENT_ACCESS_TOKEN_MAX_AGE_SECONDS,
  });
  response.cookies.set("patient_refresh_token", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: result.refreshTokenExpiresAt,
  });

  return response;
}