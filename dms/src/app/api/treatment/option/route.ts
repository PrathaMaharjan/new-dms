import { getTreatmentOptions } from "@/controller/treatments/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  console.log("hiiiiiiiii")
  const locationId = request.nextUrl.searchParams.get("locationId") ?? undefined;
  const result = await getTreatmentOptions(locationId);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status: 401 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { treatments: result.treatments } });
}