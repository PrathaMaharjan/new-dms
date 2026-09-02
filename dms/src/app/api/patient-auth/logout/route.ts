// src/app/api/patient-auth/logout/route.ts
import { logoutPatient } from "@/controller/patient portal/controller";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("patient_refresh_token")?.value;

  await logoutPatient(refreshToken);

  const response = NextResponse.json({ success: true, data: {} });
  response.cookies.set("patient_access_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("patient_refresh_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
