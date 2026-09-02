import { getMyPastVisits } from "@/controller/patient portal/appointments/controller";
import { getMyProfile } from "@/controller/patient portal/getMyProfile/controller";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await getMyProfile();
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: { visits: result.name } });
}