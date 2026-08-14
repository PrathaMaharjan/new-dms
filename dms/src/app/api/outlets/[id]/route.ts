import {
  deleteLocation,
  getLocationById,
  LocationErrorCode,
  updateLocation,
} from "@/controller/outlets/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<LocationErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION: 400,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  SERVER_ERROR: 500,
};

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await deleteLocation(id);
  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json(
      {
        success: false,
        statusCode: status,
        error: result.error,
        code: result.code,
      },
      { status },
    );
  }
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await updateLocation(id, body);
  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { location: result.location } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getLocationById(id);
  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, statusCode: status, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { location: result.location } });
}