import { getCostByCategory } from "@/controller/finacial-analysis/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const range = (request.nextUrl.searchParams.get("range") ?? "6m") as any;
  const locationId = request.nextUrl.searchParams.get("locationId") ?? undefined;
  const result = await getCostByCategory(range, locationId);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: result.code === "UNAUTHORIZED" ? 401 : 500 });
  return NextResponse.json({ success: true, statusCode: 200, data: { breakdown: result.breakdown } });
}

