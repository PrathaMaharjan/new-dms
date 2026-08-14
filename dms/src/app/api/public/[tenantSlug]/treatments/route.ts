import { NextRequest, NextResponse } from "next/server";
import { getPublicTreatmentOptions } from "@/lib/controllers/public-treatments.controller";

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const locationId = request.nextUrl.searchParams.get("locationId") ?? undefined;

  const result = await getPublicTreatmentOptions(tenantSlug, locationId);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 404 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { treatments: result.treatments } });
}