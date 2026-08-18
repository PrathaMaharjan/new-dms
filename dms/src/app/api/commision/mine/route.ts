import { getMyCommissions } from "@/controller/commissions/details/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const result = await getMyCommissions(sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: result.code === "UNAUTHORIZED" ? 401 : 500 });
  return NextResponse.json({ success: true, statusCode: 200, data: { totalEarnedCents: result.totalEarnedCents, entries: result.entries } });
}