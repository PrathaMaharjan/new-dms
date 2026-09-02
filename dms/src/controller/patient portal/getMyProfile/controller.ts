import { db } from "@/db";
import { patients } from "@/db/schema";
import { PatientSessionError, requirePatientSession } from "@/lib/auth/get-patient-seesion";
import { eq } from "drizzle-orm";

export async function getMyProfile() {
  try {
    const session = await requirePatientSession();
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, session.patientId) });
    if (!patient) return { success: false, error: "Patient not found." };
    return { success: true, name: `${patient.firstName} ${patient.lastName}`, email: patient.email };
  } catch (err) {
    if (err instanceof PatientSessionError) return { success: false, error: err.message };
    return { success: false, error: "Something went wrong." };
  }
}