import { OrgErrorCode, updateOrganizationStatus } from "@/controller/superadmin/org/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<OrgErrorCode, number> = {
  UNAUTHORIZED: 401, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await updateOrganizationStatus(id, body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 200, data: { status: result.status } });
}