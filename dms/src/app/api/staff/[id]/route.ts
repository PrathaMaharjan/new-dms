import {
  deleteStaff,
  getStaffById,
  StaffErrorCode,
  updateStaff,
} from "@/controller/staff/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<StaffErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 400,
  DUPLICATE: 409,
  SERVER_ERROR: 500,
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await updateStaff(id, body);
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
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { staff: result.staff },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await deleteStaff(id);
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getStaffById(id);
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
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: {
      staff: result.staff,
    },
  });
}
