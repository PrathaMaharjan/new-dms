import { getMonthlyBreakdown } from "@/controller/finacial-analysis/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const monthCount = sp.has("months") ? Number(sp.get("months")) : 12;
  const locationId = sp.get("locationId") ?? undefined;
  const offset = sp.has("offset") ? Number(sp.get("offset")) : 0;

  const result = await getMonthlyBreakdown(monthCount, locationId, offset);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.code === "UNAUTHORIZED" ? 401 : 500 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { rows: result.rows, pagination: result.pagination } });
}