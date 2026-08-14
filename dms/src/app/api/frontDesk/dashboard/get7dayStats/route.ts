import { getFrontDeskLast7Days } from "@/controller/frontdesk-dashboard/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  }
  const result = await getFrontDeskLast7Days(locationId);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.code === "UNAUTHORIZED" ? 401 : 500 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { days: result.days } });
}