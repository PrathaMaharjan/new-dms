import { getOutletPerformance } from "@/controller/org/billing/controller";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await getOutletPerformance();
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.code === "UNAUTHORIZED" ? 401 : 500 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { outlets: result.outlets } });
}