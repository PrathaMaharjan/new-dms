import {
    getInventoryStatus,
  OrganizationErrorCode,
  toggleInventoryEnabled,
} from "@/controller/inventory/org/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<OrganizationErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await toggleInventoryEnabled(body?.inventoryEnabled);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: STATUS_BY_CODE[result.code] },
    );
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { inventoryEnabled: result.inventoryEnabled },
  });
}

export async function GET() {
  const result = await getInventoryStatus();
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: STATUS_BY_CODE[result.code] },
    );
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { inventoryEnabled: result.inventoryEnabled },
  });
}
