import { CommissionErrorCode } from "@/controller/commissions/controller";
import { getAllDoctorCommissions } from "@/controller/commissions/details/controller";
import { NextRequest, NextResponse } from "next/server";
const STATUS_BY_CODE: Record<CommissionErrorCode, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const result = await getAllDoctorCommissions(
    sp.get("from") ?? undefined,
    sp.get("to") ?? undefined,
    sp.get("locationId") ?? undefined
  );
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 200, data: { doctors: result.doctors } });
}