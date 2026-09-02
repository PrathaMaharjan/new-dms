import { getMyLedgerHistory } from "@/controller/patient portal/getLedgerHistory/controller";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await getMyLedgerHistory();
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: { summary: result.summary, entries: result.entries } });
}