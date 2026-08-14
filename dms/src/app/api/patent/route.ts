import { createPatient, getPatients, PatientErrorCode } from "@/controller/patents/controller";
import { NextRequest, NextResponse } from "next/server";
const STATUS_BY_CODE: Record<PatientErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  SERVER_ERROR: 500,
};
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const limit = sp.has("limit") ? Number(sp.get("limit")) : undefined;
  const offset = sp.has("offset") ? Number(sp.get("offset")) : undefined;

  const result = await getPatients({ limit, offset });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { patients: result.patients, pagination: result.pagination },
  });
}
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await createPatient(body);

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 201, data: { patient: result.patient } }, { status: 201 });
}