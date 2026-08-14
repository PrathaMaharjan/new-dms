import { getTopOutstandingPatients } from "@/controller/admin-dashboard/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const result = await getTopOutstandingPatients({
    locationId: sp.get("locationId") ?? undefined,
    search: sp.get("search") ?? undefined,
    limit: sp.has("limit") ? Number(sp.get("limit")) : undefined,
    offset: sp.has("offset") ? Number(sp.get("offset")) : undefined,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.code === "UNAUTHORIZED" ? 401 : 500 });
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { patients: result.patients, pagination: result.pagination },
  });
}