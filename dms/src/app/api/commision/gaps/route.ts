import { CommissionErrorCode } from "@/controller/commissions/controller";
import { getMissingCommissions } from "@/controller/commissions/details/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<CommissionErrorCode, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("locationId") ?? undefined;
  const result = await getMissingCommissions(locationId);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 200, data: { gaps: result.gaps } });
}