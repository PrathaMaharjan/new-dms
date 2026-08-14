import { createStaff, getStaffList, StaffErrorCode } from "@/controller/staff/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<StaffErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 400,
  DUPLICATE: 409,
  SERVER_ERROR: 500,
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await createStaff(body);

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json(
    { success: true, statusCode: 201, data: { staff: result.staff, emailSent: result.emailSent } },
    { status: 201 }
  );
}


export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const locationId = sp.get("locationId") ?? undefined;
  const limit = sp.has("limit") ? Number(sp.get("limit")) : undefined;
  const offset = sp.has("offset") ? Number(sp.get("offset")) : undefined;

  const result = await getStaffList(locationId, { limit, offset });
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { staff: result.staff, pagination: result.pagination },
  });
}