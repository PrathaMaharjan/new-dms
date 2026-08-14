import { CollectionsRange, getAllOrganizationDashboard } from "@/controller/org/billing/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const result = await getAllOrganizationDashboard({
    locationId: sp.get("locationId") ?? undefined,
    chartRange: (sp.get("chartRange") as CollectionsRange | null) ?? undefined,
    search: sp.get("search") ?? undefined,
    limit: sp.has("limit") ? Number(sp.get("limit")) : undefined,
    offset: sp.has("offset") ? Number(sp.get("offset")) : undefined,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 401 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { dashboard: result.dashboard } });
}