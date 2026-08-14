import { InventoryErrorCode } from "@/controller/inventory/category/controller";
import { createInventoryItem, deleteInventoryItem, getInventoryItems } from "@/controller/inventory/inventoryItem/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<InventoryErrorCode, number> = {
  UNAUTHORIZED: 401, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await createInventoryItem(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 201, data: { item: result.item } }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const locationId = sp.get("locationId");
  if (!locationId) return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });

  const result = await getInventoryItems(locationId, {
    search: sp.get("search") ?? undefined,
    lowStockOnly: sp.get("lowStockOnly") === "true",
    limit: sp.has("limit") ? Number(sp.get("limit")) : undefined,
    offset: sp.has("offset") ? Number(sp.get("offset")) : undefined,
  });
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 200, data: { items: result.items, pagination: result.pagination } });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
  }
  if (!locationId) {
    return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  }
  const result = await deleteInventoryItem(id, locationId);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}