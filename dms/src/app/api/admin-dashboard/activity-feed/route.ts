import { getRecentActivityFeed } from "@/controller/admin-dashboard/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const locationId = sp.get("locationId") ?? undefined;

  const limit = sp.has("limit") ? Number(sp.get("limit")) : undefined;
  const result = await getRecentActivityFeed(locationId, limit);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.code === "UNAUTHORIZED" ? 401 : 500 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { activities: result.activities } });
}