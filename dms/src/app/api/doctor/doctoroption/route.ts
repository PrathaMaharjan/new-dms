import { getDoctorNameAndId } from "@/controller/doctor/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const locationId =
    request.nextUrl.searchParams.get("locationId") ?? undefined;
  const result = await getDoctorNameAndId(locationId);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, code: result.code },
      { status: 401 },
    );
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: { doctors: result.doctors },
  });
}
