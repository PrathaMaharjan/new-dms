import { getDoctorAvailableSlots } from "@/controller/patient portal/appointments/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const date = request.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ success: false, error: "date is required" }, { status: 400 });
  }
  const result = await getDoctorAvailableSlots(id, date);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: { slots: result.slots } });
}