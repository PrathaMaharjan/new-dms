import { InventoryErrorCode } from "@/controller/inventory/category/controller";
import { addInventoryMovement, getMovementHistory } from "@/controller/inventory/inventoryItem/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<InventoryErrorCode, number> = {
  UNAUTHORIZED: 401, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getMovementHistory(id);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 200, data: { movements: result.movements } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // console.log(id)
  const body = await request.json().catch(() => null);
  const result = await addInventoryMovement(body?.locationId, { ...body, itemId: id });
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 201, data: { movementId: result.movementId, newStock: result.newStock } }, { status: 201 });
}