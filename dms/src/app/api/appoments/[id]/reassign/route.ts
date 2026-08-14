// src/app/api/appointments/[id]/reassign/route.ts
import { reassignAppointmentDoctor } from "@/controller/appoments/controller";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await reassignAppointmentDoctor(id, body?.providerId);

  if (!result.success) {
    const status = result.code === "DOUBLE_BOOKED" ? 409 : 400;
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}