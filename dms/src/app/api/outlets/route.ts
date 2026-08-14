import { createLocation, getLocations, LocationErrorCode } from "@/controller/outlets/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<LocationErrorCode, number> = {

  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION: 400,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  SERVER_ERROR: 500,
};


export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await createLocation(body);

  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 201, data: { location: result.location } }, { status: 201 });
}

export async function GET() {
  const result = await getLocations();
  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { locations: result.locations } });
}