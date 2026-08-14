import { getSuperAdminDetails, SuperAdminErrorCode, updateSuperAdminDetails } from "@/controller/superadmin/profile/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<SuperAdminErrorCode, number> = {
  UNAUTHORIZED: 401, VALIDATION: 400, DUPLICATE: 409, SERVER_ERROR: 500,
};

export async function GET() {
  const result = await getSuperAdminDetails();
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { admin: result.admin } });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await updateSuperAdminDetails(body);
  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { admin: result.admin } });
}