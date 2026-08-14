// src/app/api/patients/[id]/medical-history/route.ts
import { getMedicalHistory } from "@/controller/patents/controller";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getMedicalHistory(id);

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status: 404 });
  }
  return NextResponse.json({ success: true, statusCode: 200, data: { medicalHistory: result.medicalHistory } });
}