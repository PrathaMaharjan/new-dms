import {
  AppointmentTrendRange,
  getDoctorDashboardFull,
} from "@/controller/doctor/doctorDashboard/homepage/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const locationId = sp.get("locationId");
  const trendRange = (sp.get("trendRange") ?? "7d") as AppointmentTrendRange; // ADDED

  if (!locationId) {
    return NextResponse.json(
      { success: false, error: "locationId is required" },
      { status: 400 },
    );
  }

  const result = await getDoctorDashboardFull(locationId, trendRange);

  if (!result.success) {
    // CHANGED - was hardcoded 401 regardless of the actual failure reason.
    // The function's own error message is checked for the auth-specific
    // phrase to decide the real status, rather than assuming every
    // failure is unauthorized.
    const status =
      result.error.toLowerCase().includes("logged in") ||
      result.error.toLowerCase().includes("session")
        ? 401
        : 500;
    return NextResponse.json(
      { success: false, error: result.error },
      { status },
    );
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { dashboard: result.dashboard },
  });
}
