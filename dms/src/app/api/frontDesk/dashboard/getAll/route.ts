import { getDoctorLoadToday, getFrontDeskAppointmentTrend, getFrontDeskStats, getFrontDeskTodaysSchedule, getFrontDeskTodayStatus } from "@/controller/frontdesk-dashboard/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("locationId");
  const range = (request.nextUrl.searchParams.get("range") || "7days") as "7days" | "30days" | "1year" | "7d" | "1m" | "1y";

  if (!locationId) {
    return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  }

  const [stats, trendResult, todayStatus, schedule, doctorLoad] = await Promise.all([
    getFrontDeskStats(locationId),
    getFrontDeskAppointmentTrend(locationId, range),
    getFrontDeskTodayStatus(locationId),
    getFrontDeskTodaysSchedule(locationId),
    getDoctorLoadToday(locationId),
  ]);

  const failed = [stats, trendResult, todayStatus, schedule, doctorLoad].find((r) => !r.success);
  if (failed && !failed.success) {
    return NextResponse.json({ success: false, error: failed.error }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: {
      stats: (stats as { success: true; stats: unknown }).stats,
      last7Days: (trendResult as { success: true; days: unknown }).days,
      trend: (trendResult as { success: true; trend: unknown }).trend,
      todayStatus: (todayStatus as { success: true; breakdown: unknown }).breakdown,
      todaysSchedule: (schedule as { success: true; appointments: unknown }).appointments,
      doctorLoad: (doctorLoad as { success: true; doctors: unknown }).doctors,
    },
  });
}