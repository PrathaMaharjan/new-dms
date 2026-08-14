// src/app/api/billing/patients/route.ts
import { getBillingPatients } from "@/controller/payments/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const locationId = sp.get("locationId");
  if (!locationId) {
    return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  }

  const result = await getBillingPatients(locationId, {
    search: sp.get("search") ?? undefined,
    balanceFilter: (sp.get("balanceFilter") as "all" | "due" | "settled" | null) ?? undefined,
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