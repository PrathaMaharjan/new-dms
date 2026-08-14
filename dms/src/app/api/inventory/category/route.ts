import { createCategory, getCategories, InventoryErrorCode } from "@/controller/inventory/category/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<InventoryErrorCode, number> = {
  UNAUTHORIZED: 401, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  const result = await getCategories(locationId);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 200, data: { categories: result.categories } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await createCategory(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 201, data: { category: result.category } }, { status: 201 });
}