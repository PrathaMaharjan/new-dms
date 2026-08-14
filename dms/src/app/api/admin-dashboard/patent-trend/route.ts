import { getNewPatientTrend, TrendRange } from "@/controller/admin-dashboard/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const locationId = sp.get("locationId") ?? undefined;
  const range = (sp.get("range") ?? "14d") as TrendRange;

  const result = await getNewPatientTrend(range, locationId); // CHANGED: swapped argument order to match the controller's new (range, locationId) signature

  if (!result.success) {
    const status = result.code === "UNAUTHORIZED" ? 401 : result.code === "VALIDATION" ? 400 : 500;
    return NextResponse.json({ success: false, error: result.error }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { trend: result.trend } });
}