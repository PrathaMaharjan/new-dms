import { ReportErrorCode, sendFullHistoryReport } from "@/controller/patient-reports/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<ReportErrorCode, number> = {
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  VALIDATION: 400,
  SERVER_ERROR: 500,
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await sendFullHistoryReport(id);

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}