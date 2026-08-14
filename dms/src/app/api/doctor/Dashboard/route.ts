import { getAppointments } from "@/controller/doctor/doctorDashboard/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const locationId = sp.get("locationId");
  if (!locationId) {
    return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  }

  const result = await getAppointments(locationId, {
    doctorId: sp.get("doctorId") ?? undefined,
    status: sp.get("status") ?? undefined,
    view: (sp.get("view") as "today" | "upcoming" | "checkin" | "completed" | "all" | null) ?? undefined,
    date: sp.get("date") ?? undefined,
    limit: sp.has("limit") ? Number(sp.get("limit")) : undefined,
    offset: sp.has("offset") ? Number(sp.get("offset")) : undefined,
  });

  if (!result.success) {
    const status = result.code === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { appointments: result.appointments, pagination: result.pagination },
  });
}
