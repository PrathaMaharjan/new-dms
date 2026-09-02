import { getMyPastVisits } from "@/controller/patient portal/appointments/controller";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await getMyPastVisits();
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: { visits: result.visits } });
}