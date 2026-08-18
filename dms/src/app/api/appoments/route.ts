import { bookAppointment, BookAppointmentErrorCode, getAppointments } from "@/controller/appoments/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<BookAppointmentErrorCode, number> = {

  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 400,
  DOUBLE_BOOKED: 409,
  SERVER_ERROR: 500,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await bookAppointment(body);

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json(
      { success: false, statusCode: status, error: result.error, code: result.code },
      { status, headers: corsHeaders }
    );
  }

  return NextResponse.json(
    { success: true, statusCode: 201, data: { appointmentId: result.appointmentId, patientId: result.patientId, wasNewPatient: result.wasNewPatient } },
    { status: 201, headers: corsHeaders }
  );
}
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const locationId = sp.get("locationId");
  if (!locationId) {
    return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  }

  const result = await getAppointments(locationId, {
    doctorId: sp.get("doctorId") ?? undefined,
    status: sp.get("status") ?? undefined,
    date: sp.get("date") ?? undefined,
    limit: sp.has("limit") ? Number(sp.get("limit")) : undefined,
    offset: sp.has("offset") ? Number(sp.get("offset")) : undefined,
  });

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { appointments: result.appointments, pagination: result.pagination },
  });
}