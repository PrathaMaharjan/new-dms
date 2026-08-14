// src/app/api/admin/dashboard/stats/route.ts
import { getAdminDashboardStats } from "@/controller/admin-dashboard/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("locationId") ?? undefined;

  const result = await getAdminDashboardStats(locationId);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.code === "UNAUTHORIZED" ? 401 : 500 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { stats: result.stats } });
}