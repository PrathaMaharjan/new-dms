import { addLedgerEntry, getLedgerHistory, LedgerErrorCode } from "@/controller/payments/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<LedgerErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getLedgerHistory(id);

if (!result.success) {
  const status = STATUS_BY_CODE[result.code];
  console.log("result.code:", result.code, "resolved status:", status);
  return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
}  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { summary: result.summary, entries: result.entries },
  });
}



export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await addLedgerEntry({ ...body, patientId: id });

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json(
    { success: true, statusCode: 201, data: { entryId: result.entryId, newBalanceCents: result.newBalanceCents } },
    { status: 201 }
  );
}

