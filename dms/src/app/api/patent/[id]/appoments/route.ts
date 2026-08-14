import { getAppointmentHistory } from "@/controller/patents/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const limit = sp.has("limit") ? Number(sp.get("limit")) : undefined;
  const offset = sp.has("offset") ? Number(sp.get("offset")) : undefined;

  const result = await getAppointmentHistory(id, { limit, offset });

  if (!result.success) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { appointments: result.appointments, pagination: result.pagination },
  });
}