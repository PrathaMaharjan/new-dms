import { CollectionsRange, getCollectionsChart } from "@/controller/org/billing/controller";
import { NextRequest, NextResponse } from "next/server";
import { string } from "zod";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const range = (sp.get("range") ?? "7d") as CollectionsRange;
  const locationId = sp.get("locationId") ?? undefined;

  const result = await getCollectionsChart(range,locationId)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.code === "UNAUTHORIZED" ? 401 : 500 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { chart: result.chart } });
}