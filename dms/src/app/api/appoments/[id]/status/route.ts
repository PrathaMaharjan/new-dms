import { updateAppointmentStatus } from "@/controller/appoments/controller";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await updateAppointmentStatus(id, body); // pass the whole body, not just body?.status

  if (!result.success) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: {} });
}