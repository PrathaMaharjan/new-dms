import { ClinicalNoteErrorCode, getNoteableAppointments, saveClinicalEntry } from "@/controller/clinical/controller";
import { NextRequest, NextResponse } from "next/server";

const STATUS_BY_CODE: Record<ClinicalNoteErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  SERVER_ERROR: 500,
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getNoteableAppointments(id);
  console.log(result)
  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({
    success: true,
    statusCode: 200,
    data: {
      appointments: result.appointments,
      totalAppointmentCount: result.totalAppointmentCount,
    },
  });
}



export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const result = await saveClinicalEntry(id, body);
  if (!result.success) {
    const status = STATUS_BY_CODE[result.code];
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ success: true, statusCode: 201, data: { noteId: result.noteId } }, { status: 201 });
}

