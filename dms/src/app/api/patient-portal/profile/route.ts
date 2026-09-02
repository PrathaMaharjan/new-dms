import { updateMyProfile } from "@/app/patientPortal/changeDetails/controller";
import { getMyProfile } from "@/controller/patient portal/controller";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await updateMyProfile(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: {} });
}



export async function GET() {
  const result = await getMyProfile();
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: result.data });
}