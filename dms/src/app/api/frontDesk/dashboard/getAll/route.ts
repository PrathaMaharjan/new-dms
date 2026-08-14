import { getDoctorLoadToday, getFrontDeskLast7Days, getFrontDeskStats, getFrontDeskTodaysSchedule, getFrontDeskTodayStatus } from "@/controller/frontdesk-dashboard/controller";
import { NextRequest, NextResponse } from "next/server";


export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  }

  const [stats, last7Days, todayStatus, schedule, doctorLoad] = await Promise.all([
    getFrontDeskStats(locationId),
    getFrontDeskLast7Days(locationId),
    getFrontDeskTodayStatus(locationId),
    getFrontDeskTodaysSchedule(locationId),
    getDoctorLoadToday(locationId),
  ]);

  const failed = [stats, last7Days, todayStatus, schedule, doctorLoad].find((r) => !r.success);
  if (failed && !failed.success) {
    return NextResponse.json({ success: false, error: failed.error }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: {
      stats: (stats as { success: true; stats: unknown }).stats,
      last7Days: (last7Days as { success: true; days: unknown }).days,
      todayStatus: (todayStatus as { success: true; breakdown: unknown }).breakdown,
      todaysSchedule: (schedule as { success: true; appointments: unknown }).appointments,
      doctorLoad: (doctorLoad as { success: true; doctors: unknown }).doctors,
    },
  });
}