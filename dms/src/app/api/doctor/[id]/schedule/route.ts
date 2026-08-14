// src/app/api/doctors/[id]/schedule/route.ts
import { DoctorErrorCode, updateDoctorSchedule } from "@/controller/doctor/controller";
import { NextRequest, NextResponse } from "next/server";
// import { updateDoctorSchedule, type DoctorErrorCode } from "@/lib/controllers/doctors.controller";

const STATUS_BY_CODE: Record<DoctorErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  SERVER_ERROR: 500,
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await updateDoctorSchedule(id, body);

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}