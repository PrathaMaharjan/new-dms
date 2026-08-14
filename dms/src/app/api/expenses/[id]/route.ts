import { deleteExpense, ExpenseErrorCode, updateExpense } from "@/controller/expenses/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<ExpenseErrorCode, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteExpense(id);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await updateExpense(id, body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}