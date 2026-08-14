import { getAppointmentHistoryByDoctor, HistoryErrorCode } from "@/controller/doctor/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<HistoryErrorCode, number> = {
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const limit = sp.has("limit") ? Number(sp.get("limit")) : undefined;
  const offset = sp.has("offset") ? Number(sp.get("offset")) : undefined;
  const from = sp.has("from") ? new Date(sp.get("from")!) : undefined;
  const to = sp.has("to") ? new Date(sp.get("to")!) : undefined;

  const result = await getAppointmentHistoryByDoctor(id, { limit, offset, from, to });

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