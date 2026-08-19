import { OrganizationErrorCode } from "@/controller/inventory/org/controller";
import { getWorkloadThresholds, updateWorkloadThresholds } from "@/controller/workload/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<OrganizationErrorCode, number> = {
  UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, SERVER_ERROR: 500,
};

export async function GET() {
  const result = await getWorkloadThresholds();
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: STATUS_BY_CODE[result.code] });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { workloadHealthyMax: result.workloadHealthyMax, workloadBusyMax: result.workloadBusyMax } });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await updateWorkloadThresholds(body);
  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { workloadHealthyMax: result.workloadHealthyMax, workloadBusyMax: result.workloadBusyMax } });
}