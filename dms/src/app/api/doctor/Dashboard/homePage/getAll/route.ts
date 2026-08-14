import { getDoctorDashboardFull } from "@/controller/doctor/doctorDashboard/homepage/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  }

  const result = await getDoctorDashboardFull(locationId);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 401 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { dashboard: result.dashboard } });
}