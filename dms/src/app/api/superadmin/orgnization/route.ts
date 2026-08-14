import { createOrganizationWithOwner, OrgErrorCode, getOrganizations } from "@/controller/superadmin/org/controller";
import { NextRequest, NextResponse } from "next/server";
const STATUS_BY_CODE: Record<OrgErrorCode, number> = {
  UNAUTHORIZED: 401, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await createOrganizationWithOwner(body);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  }
  return NextResponse.json(
    { success: true, statusCode: 201, data: { organization: result.organization, owner: result.owner, emailSent: result.emailSent } },
    { status: 201 }
  );
}
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const result = await getOrganizations({
    search: sp.get("search") ?? undefined,
    status: sp.get("status") ?? undefined,
    limit: sp.has("limit") ? Number(sp.get("limit")) : undefined,
    offset: sp.has("offset") ? Number(sp.get("offset")) : undefined,
  });
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 200, data: { organizations: result.organizations, pagination: result.pagination } });
}