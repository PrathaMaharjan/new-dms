// src/app/api/doctors/me/schedule/route.ts
import { DoctorErrorCode, updateMySchedule } from "@/controller/doctor/controller";
import { NextRequest, NextResponse } from "next/server";
// import { updateMySchedule, type DoctorErrorCode } from "@/lib/controllers/doctors.controller";

const STATUS_BY_CODE: Record<DoctorErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  SERVER_ERROR: 500,
};

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await updateMySchedule(body);

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}