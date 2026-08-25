import { DoctorErrorCode, getDoctor, updateMySchedule } from "@/controller/doctor/controller";
import { requireSession } from "@/lib/auth/get-session";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<DoctorErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  SERVER_ERROR: 500,
};

export async function GET() {
  try {
    const session = await requireSession();
    const result = await getDoctor(session.userId);

    if (!result.success) {
      const status = STATUS_BY_CODE[result.code];
      return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
    }
    return NextResponse.json({ success: true, statusCode: 200, data: { schedule: result.doctor.schedule } });
  } catch (err: any) {
    return NextResponse.json({ success: false, statusCode: 401, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await updateMySchedule(body);

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}