import { createExpense, ExpenseErrorCode, getCombinedExpenses } from "@/controller/expenses/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<ExpenseErrorCode, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, VALIDATION: 400, NOT_FOUND: 404, DUPLICATE: 409, SERVER_ERROR: 500,
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await createExpense(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  return NextResponse.json({ success: true, statusCode: 201, data: { expenseId: result.expenseId } }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const result = await getCombinedExpenses({
    locationId: sp.get("locationId") ?? undefined,
    categoryId: sp.get("categoryId") ?? undefined,
    thisMonth: sp.get("thisMonth") === "true",
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    limit: sp.has("limit") ? Number(sp.get("limit")) : undefined,
    offset: sp.has("offset") ? Number(sp.get("offset")) : undefined,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.code === "UNAUTHORIZED" ? 401 : 500 });
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { expenses: result.expenses, totalCents: result.totalCents, pagination: result.pagination },
  });
}