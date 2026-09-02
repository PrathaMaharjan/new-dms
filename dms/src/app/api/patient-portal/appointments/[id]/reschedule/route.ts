import { rescheduleMyAppointment } from "@/controller/patient portal/appointments/controller";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await rescheduleMyAppointment(id, body);
  if (!result.success)
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 },
    );
  return NextResponse.json({ success: true, data: {} });
}
