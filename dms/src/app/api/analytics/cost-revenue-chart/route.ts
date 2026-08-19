import {
  getCostRevenueTrend,
  type AnalyticsRange,
} from "@/controller/finacial-analysis/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const range = (sp.get("range") ?? "1y") as AnalyticsRange;
  const locationId = sp.get("locationId") ?? undefined;

  const result = await getCostRevenueTrend(range, locationId);

  if (!result.success)
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.code === "UNAUTHORIZED" ? 401 : 500 },
    );
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { trend: result.trend },
  });
}
