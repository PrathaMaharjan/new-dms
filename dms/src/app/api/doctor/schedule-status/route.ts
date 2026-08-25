// src/app/api/doctors/schedule-timeline/route.ts
import { getAllDoctorsScheduleTimeline } from "@/controller/doctor/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const locationId = sp.get("locationId");
  const date = sp.get("date") ?? new Date().toISOString().slice(0, 10);

  const result = await getAllDoctorsScheduleTimeline(locationId, date);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status: 400 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { doctors: result.doctors } });
}