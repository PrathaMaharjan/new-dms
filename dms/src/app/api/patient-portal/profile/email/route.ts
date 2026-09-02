import { updateMyEmail } from "@/app/patientPortal/changeDetails/controller";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const result = await updateMyEmail(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: {} });
}