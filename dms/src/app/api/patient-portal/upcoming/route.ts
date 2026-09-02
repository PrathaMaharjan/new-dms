import { getMyUpcomingAppointment } from "@/controller/patient portal/appointments/controller";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await getMyUpcomingAppointment();
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: { appointment: result.appointment } });
}