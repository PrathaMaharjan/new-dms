import { InventoryErrorCode } from "@/controller/inventory/category/controller";
import { getInventoryItem, updateInventoryItem } from "@/controller/inventory/inventoryItem/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<InventoryErrorCode, number> = {
  UNAUTHORIZED: 401, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  }
  const result = await getInventoryItem(id, locationId);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { item: result.item } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await updateInventoryItem(id, body?.locationId, body);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { item: result.item } });
}