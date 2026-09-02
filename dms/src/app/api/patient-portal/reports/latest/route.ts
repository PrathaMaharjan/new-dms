import { getMyLatestVisitReportPdf } from "@/controller/patient portal/downloadPdf/controller";
import { NextResponse } from "next/server";

export async function GET() {
    console.log("hi")
  const result = await getMyLatestVisitReportPdf();
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  console.log(result)

  return new NextResponse(new Uint8Array(result.pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}