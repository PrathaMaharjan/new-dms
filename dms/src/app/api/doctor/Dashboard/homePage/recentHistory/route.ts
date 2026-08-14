import { getRecentPatientsSeen } from "@/controller/doctor/doctorDashboard/homepage/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const locationId = sp.get("locationId");
  if (!locationId) {
    return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  }
  const limit = sp.has("limit") ? Number(sp.get("limit")) : undefined;
  const result = await getRecentPatientsSeen(locationId, limit);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.code === "UNAUTHORIZED" ? 401 : 500 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { patients: result.patients } });
}