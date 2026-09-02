import { db } from "@/db";
import { appointments, ledgerEntries, patients, treatments } from "@/db/schema";
import { PatientSessionError, requirePatientSession } from "@/lib/auth/get-patient-seesion";
import { and, eq } from "drizzle-orm";

export type LedgerEntryRow = {
   id: string;
  type: "charge" | "payment" | "adjustment";
  amountCents: number;
  status: "due" | "settled" | null; // ADDED - meaningful only for charges
  paymentMethod: string | null;
  note: string | null;
  appointmentTreatmentName: string | null;
  createdAt: Date;
  balanceAfter: number;
};

export type LedgerHistoryResult =
  | {
      success: true;
      summary: { totalChargedCents: number; totalPaidCents: number; balanceDueCents: number; outstandingCents: number }; // ADDED outstandingCents
      entries: LedgerEntryRow[];
    }
  | { success: false; error: string; code: "NOT_FOUND" | "SERVER_ERROR" };

async function getLedgerHistory(patientId: string, orgId: string): Promise<LedgerHistoryResult> {
  try {
    const patient = await db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.orgId, orgId)),
    });
    if (!patient) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }

    const rows = await db
      .select({
        id: ledgerEntries.id,
        type: ledgerEntries.type,
        amountCents: ledgerEntries.amountCents,
        status: ledgerEntries.status,
        paymentMethod: ledgerEntries.paymentMethod,
        note: ledgerEntries.note,
        appointmentTreatmentName: treatments.name,
        createdAt: ledgerEntries.createdAt,
      })
      .from(ledgerEntries)
      .leftJoin(appointments, eq(ledgerEntries.appointmentId, appointments.id))
      .leftJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .where(eq(ledgerEntries.patientId, patientId))
      .orderBy(ledgerEntries.createdAt);

    let running = 0;
    const entries = rows.map((r) => {
      running += r.amountCents;
      return { ...r, balanceAfter: running };
    });

    const totalChargedCents = rows.filter((r) => r.type === "charge").reduce((sum, r) => sum + r.amountCents, 0);
    const totalPaidCents = Math.abs(rows.filter((r) => r.type === "payment").reduce((sum, r) => sum + r.amountCents, 0));
    const balanceDueCents = running;
    const outstandingCents = rows
      .filter((r) => r.type === "charge" && r.status === "due")
      .reduce((sum, r) => sum + r.amountCents, 0);

    return {
      success: true,
      summary: { totalChargedCents, totalPaidCents, balanceDueCents, outstandingCents }, // ADDED outstandingCents here
      entries,
    };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Something went wrong loading the ledger.", code: "SERVER_ERROR" };
  }
}


export async function getMyLedgerHistory(): Promise<LedgerHistoryResult> {
  try {
    const session = await requirePatientSession();
    return await getLedgerHistory(session.patientId, session.orgId);
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message, code: "SERVER_ERROR" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading your billing history.", code: "SERVER_ERROR" };
  }
}