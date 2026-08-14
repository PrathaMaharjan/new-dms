import { changeSuperAdminPassword, SuperAdminErrorCode } from "@/controller/superadmin/profile/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<SuperAdminErrorCode, number> = {
  UNAUTHORIZED: 401, VALIDATION: 400, DUPLICATE: 409, SERVER_ERROR: 500,
};

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await changeSuperAdminPassword(body);
  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}