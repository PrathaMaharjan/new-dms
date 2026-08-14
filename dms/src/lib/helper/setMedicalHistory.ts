import { db } from "@/db";
import { requireSession, SessionError } from "../auth/get-session";
import { and, eq, isNull } from "drizzle-orm";
import { patientMedicalRecords, patients } from "@/db/schema";
import { PatientErrorCode } from "@/controller/patents/controller";

export type SetMedicalHistoryResult = { success: true } | { success: false; error: string; code: PatientErrorCode };

export async function setMedicalHistory(
  patientId: string,
  type: "allergy" | "condition" | "medication",
  values: string[]
): Promise<SetMedicalHistoryResult> {
  try {
    const session = await requireSession();

    const patient = await db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.orgId, session.orgId), isNull(patients.deletedAt)),
    });
    if (!patient) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(patientMedicalRecords)
        .where(and(eq(patientMedicalRecords.patientId, patientId), eq(patientMedicalRecords.type, type)));

      if (values.length > 0) {
        await tx.insert(patientMedicalRecords).values(values.map((value) => ({ patientId, type, value })));
      }
    });

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating medical history.", code: "SERVER_ERROR" };
  }
}