import { CommissionErrorCode, createExperienceTier, getExperienceTiers } from "@/controller/commissions/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<CommissionErrorCode, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};

export async function GET() {
  const result = await getExperienceTiers();
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 200, data: { tiers: result.tiers } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await createExperienceTier(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 201, data: { tier: result.tier } }, { status: 201 });
}