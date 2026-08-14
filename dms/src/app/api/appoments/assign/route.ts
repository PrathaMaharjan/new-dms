// src/app/api/appointments/assign/route.ts
import { assignAppointmentToPatient, BookAppointmentErrorCode } from "@/controller/appoments/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<BookAppointmentErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 404,
  DOUBLE_BOOKED: 409,
  SERVER_ERROR: 500,
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await assignAppointmentToPatient(body);

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json(
    { success: true, statusCode: 201, data: { appointmentId: result.appointmentId } },
    { status: 201 }
  );
}