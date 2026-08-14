import { deleteExpenseCategory, ExpenseErrorCode } from "@/controller/expenses/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<ExpenseErrorCode, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locationId = request.nextUrl.searchParams.get("locationId");
  if (!locationId) {
    return NextResponse.json({ success: false, error: "locationId is required" }, { status: 400 });
  }
  const result = await deleteExpenseCategory(id, locationId);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}