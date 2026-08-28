import { createTreatment, getTreatments, TreatmentErrorCode } from "@/controller/treatments/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<TreatmentErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 400,
  DUPLICATE: 409,
  SERVER_ERROR: 500,
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await createTreatment(body);

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json(
      { success: false, statusCode: status, error: result.error, code: result.code },
      { status }
    );
  }

  return NextResponse.json(
    { success: true, statusCode: 201, data: { treatment: result.treatment } },
    { status: 201 }
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const locationId = params.get("locationId") ?? undefined;
  const limit = params.has("limit") ? Number(params.get("limit")) : undefined;
  const offset = params.has("offset") ? Number(params.get("offset")) : undefined;

  const result = await getTreatments(locationId, { limit, offset });

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json(
      { success: false, statusCode: status, error: result.error, code: result.code },
      { status }
    );
  }

  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { treatments: result.treatments, pagination: result.pagination },
  });
}