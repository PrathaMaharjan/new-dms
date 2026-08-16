import { AnalyticsRange, getAllFinancialAnalytics } from "@/controller/finacial-analysis/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const range = (sp.get("range") ?? "1y") as AnalyticsRange;
  const locationId = sp.get("locationId") ?? undefined;
  const offset = sp.has("offset") ? Number(sp.get("offset")) : 0;

  const result = await getAllFinancialAnalytics(range, locationId, offset);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 401 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: result.data });
}