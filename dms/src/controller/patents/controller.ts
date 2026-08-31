import { db } from "@/db";
import { appointments, clinicalNotes, patientMedicalRecords, patients, treatments, userLocationRoles, users } from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { patientSchema, updatePatientSchema } from "@/lib/validators/patent";
// import { patientSchema } from "@/lib/validators/auth";
import { and, desc, eq, isNull, notInArray, or, sql } from "drizzle-orm";
import { HistoryErrorCode } from "../doctor/controller";
import { setMedicalHistory } from "@/lib/helper/setMedicalHistory";

export type PatientErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "NOT_FOUND"
  | "DUPLICATE"
  | "SERVER_ERROR";
export type PatientListResult =
  | {
    success: true;
    patients: {
      id: string;
      locationId: string;
      firstName: string;
      lastName: string;
      age: number | null;
      dob: string | null;
      createdAt: Date | null;
      gender: string | null;
      phone: string | null;
      email: string | null;
      bloodGroup: string | null;
      assignedDoctorName: string | null;
      lastVisit: Date | null;
      treatmentCompleted: boolean; // false = "Active", true = "Completed" - format on the frontend
    }[];
    pagination: { total: number; limit: number; offset: number };
  }
  | { success: false; error: string };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function calculateAge(dob: string | null | undefined, existingAge?: number | null): number | null {
  if (typeof existingAge === "number" && existingAge > 0) return existingAge;
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export async function getPatients(
  locationId?: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<PatientListResult> {
  try {
    const session = await requireSession();

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(options?.offset ?? 0, 0);

    const excludeUnconfirmedOnlineLead = sql`NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.patient_id = ${patients.id}
      AND a.source = 'online_booking'
      AND a.status = 'requested'
      AND NOT EXISTS (
        SELECT 1 FROM appointments a2
        WHERE a2.patient_id = ${patients.id}
        AND a2.status NOT IN ('requested', 'cancelled')
      )
    )`;

    const whereClause = locationId
      ? and(
          eq(patients.orgId, session.orgId),
          eq(patients.locationId, locationId),
          isNull(patients.deletedAt),
          excludeUnconfirmedOnlineLead,
        )
      : and(
          eq(patients.orgId, session.orgId),
          isNull(patients.deletedAt),
          excludeUnconfirmedOnlineLead,
        );

    const latestAppt = db
      .selectDistinctOn([appointments.patientId], {
        patientId: appointments.patientId,
        providerId: appointments.providerId,
        startTime: appointments.startTime,
      })
      .from(appointments)
      .where(notInArray(appointments.status, ["cancelled", "requested"]))
      .orderBy(appointments.patientId, desc(appointments.startTime))
      .as("latest_appt");

    const [results, countResult] = await Promise.all([
      db
        .select({
          id: patients.id,
          locationId: patients.locationId,
          firstName: patients.firstName,
          lastName: patients.lastName,
          age: patients.age,
          dob: patients.dob,
          createdAt: patients.createdAt,
          gender: patients.gender,
          phone: patients.phone,
          email: patients.email,
          bloodGroup: patients.bloodGroup,
          treatmentCompleted: patients.treatmentCompleted,
          lastVisit: latestAppt.startTime,
          assignedDoctorName: users.name,
        })
        .from(patients)
        .leftJoin(latestAppt, eq(latestAppt.patientId, patients.id))
        .leftJoin(users, eq(users.id, latestAppt.providerId))
        .where(whereClause)
        .orderBy(patients.lastName)
        .limit(limit)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(patients)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    const mappedPatients = results.map((p) => ({
      ...p,
      age: calculateAge(p.dob, p.age),
    }));

    return {
      success: true,
      patients: mappedPatients,
      pagination: { total, limit, offset },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message };
    }

    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading patients.",
    };
  }
}
// ------------------------------- create patent ---------------------------------
export type CreatePatientResult =
  | { success: true; patient: typeof patients.$inferSelect }
  | { success: false; error: string; code: PatientErrorCode };

export async function createPatient(input: unknown): Promise<CreatePatientResult> {
  try {
    const session = await requireSession();

    const parsed = patientSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const data = parsed.data;

    const matchConditions = [];
    if (data.phone) matchConditions.push(eq(patients.phone, data.phone));
    if (data.email && data.email.trim() !== "") matchConditions.push(eq(patients.email, data.email));

    if (matchConditions.length > 0) {
      const existing = await db.query.patients.findFirst({
        where: and(eq(patients.orgId, session.orgId), isNull(patients.deletedAt), or(...matchConditions)),
      });
      if (existing) {
        const matchedField = data.phone && existing.phone === data.phone ? "phone number" : "email";
        return {
          success: false,
          error: `A patient with this ${matchedField} already exists: ${existing.firstName} ${existing.lastName}.`,
          code: "DUPLICATE",
        };
      }
    }

    const calculatedAge = data.age ?? calculateAge(data.dob, null);

    const [patient] = await db
      .insert(patients)
      .values({
        orgId: session.orgId,
        locationId: data.locationId,
        firstName: data.firstName,
        lastName: data.lastName,
        dob: data.dob || null,
        age: calculatedAge ?? null,
        phone: data.phone || null,
        email: data.email || null,
        gender: data.gender || null,
        bloodGroup: data.bloodGroup,
        assignedDoctorId: data.assignedDoctorId || null,
      })
      .returning();

    if (data.allergies?.length) await setMedicalHistory(patient.id, "allergy", data.allergies);
    if (data.medicalHistory?.length) await setMedicalHistory(patient.id, "condition", data.medicalHistory);
    if (data.currentMedications?.length) await setMedicalHistory(patient.id, "medication", data.currentMedications);

    return { success: true, patient };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong creating the patient.", code: "SERVER_ERROR" };
  }
}

// -----------------------------delete patent ----------------------------------
export type DeletePatientResult =
  | { success: true }
  | { success: false; error: string; code: PatientErrorCode };

export async function deletePatient(
  patientId: string,
): Promise<DeletePatientResult> {
  try {
    const session = await requireSession();

    const existing = await db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.orgId, session.orgId)),
    });
    if (!existing) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }
    await db.delete(patients).where(eq(patients.id, patientId));

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong deleting the patient.",
      code: "SERVER_ERROR",
    };
  }
}

// --------------------------- get single patent ----------------------------------
export type GetPatientResult =
  | {
    success: true;
    patient: typeof patients.$inferSelect & {
      assignedDoctorName: string | null;
    };
  }
  | { success: false; error: string; code: PatientErrorCode };

export async function getPatient(patientId: string): Promise<GetPatientResult> {
  try {
    const session = await requireSession();

    const [result] = await db
      .select({
        patient: patients,
        assignedDoctorName: users.name,
      })
      .from(patients)
      .leftJoin(users, eq(users.id, patients.assignedDoctorId))
      .where(
        and(
          eq(patients.id, patientId),
          eq(patients.orgId, session.orgId),
          isNull(patients.deletedAt),
        ),
      )
      .limit(1);

    if (!result) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }

    return {
      success: true,
      patient: {
        ...result.patient,
        age: calculateAge(result.patient.dob, result.patient.age),
        assignedDoctorName: result.assignedDoctorName,
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the patient.",
      code: "SERVER_ERROR",
    };
  }
}

// --------------------------- update patent detail -----------------------------------
export type UpdatePatientResult =
  | { success: true; patient: typeof patients.$inferSelect }
  | { success: false; error: string; code: PatientErrorCode };

// export async function updatePatient(
//   patientId: string,
//   input: unknown,
// ): Promise<UpdatePatientResult> {
//   try {
//     const session = await requireSession();

//     const parsed = updatePatientSchema.safeParse(input);
//     if (!parsed.success) {
//       return {
//         success: false,
//         error: parsed.error.issues[0]?.message ?? "Invalid input.",
//         code: "VALIDATION",
//       };
//     }
//     const data = parsed.data;

//     const existing = await db.query.patients.findFirst({
//       where: and(
//         eq(patients.id, patientId),
//         eq(patients.orgId, session.orgId),
//         isNull(patients.deletedAt),
//       ),
//     });
//     if (!existing) {
//       return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
//     }
//     if (data.assignedDoctorId !== undefined) {
//       const doctor = await db
//         .select({ id: users.id })
//         .from(users)
//         .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
//         .where(
//           and(
//             eq(users.id, data.assignedDoctorId),
//             eq(users.orgId, session.orgId),
//             eq(userLocationRoles.role, "clinical"),
//             eq(users.isActive, true),
//             isNull(users.deletedAt),
//           ),
//         )
//         .limit(1);

//       if (doctor.length === 0) {
//         return {
//           success: false,
//           error: "Selected doctor could not be found.",
//           code: "NOT_FOUND",
//         };
//       }
//     }

//     const [updated] = await db
//       .update(patients)
//       .set(data)
//       .where(eq(patients.id, patientId))
//       .returning();

//     return { success: true, patient: updated };
//   } catch (err) {
//     if (err instanceof SessionError) {
//       return { success: false, error: err.message, code: "UNAUTHORIZED" };
//     }
//     console.error(err);
//     return {
//       success: false,
//       error: "Something went wrong updating the patient.",
//       code: "SERVER_ERROR",
//     };
//   }
// }

// ------------------------------- patent medical history --------------------------------------------

export async function updatePatient(patientId: string, input: unknown): Promise<UpdatePatientResult> {
  try {
    const session = await requireSession();

    const parsed = updatePatientSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const { allergies, medicalHistory, currentMedications, ...patientFields } = parsed.data;

    const existing = await db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.orgId, session.orgId), isNull(patients.deletedAt)),
    });
    if (!existing) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }

    if (patientFields.assignedDoctorId !== undefined) {
      const doctor = await db
        .select({ id: users.id })
        .from(users)
        .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
        .where(
          and(
            eq(users.id, patientFields.assignedDoctorId),
            eq(users.orgId, session.orgId),
            eq(userLocationRoles.role, "clinical"),
            eq(users.isActive, true),
            isNull(users.deletedAt)
          )
        )
        .limit(1);

      if (doctor.length === 0) {
        return { success: false, error: "Selected doctor could not be found.", code: "NOT_FOUND" };
      }
    }


    let updated = existing;
    if (Object.keys(patientFields).length > 0) {
      const [result] = await db.update(patients).set(patientFields).where(eq(patients.id, patientId)).returning();
      updated = result;
    }

    if (allergies !== undefined) await setMedicalHistory(patientId, "allergy", allergies);
    if (medicalHistory !== undefined) await setMedicalHistory(patientId, "condition", medicalHistory);
    if (currentMedications !== undefined) await setMedicalHistory(patientId, "medication", currentMedications);

    return { success: true, patient: updated };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating the patient.", code: "SERVER_ERROR" };
  }
}











export type GetMedicalHistoryResult =
  | {
    success: true;
    medicalHistory: { allergies: string[]; medicalHistory: string[]; currentMedications: string[] };
  }
  | { success: false; error: string; code: PatientErrorCode };

export async function getMedicalHistory(patientId: string): Promise<GetMedicalHistoryResult> {
  try {
    const session = await requireSession();

    const patient = await db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.orgId, session.orgId), isNull(patients.deletedAt)),
    });
    if (!patient) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }

    const records = await db
      .select({ type: patientMedicalRecords.type, value: patientMedicalRecords.value })
      .from(patientMedicalRecords)
      .where(eq(patientMedicalRecords.patientId, patientId))
      .orderBy(patientMedicalRecords.createdAt);

    return {
      success: true,
      medicalHistory: {
        allergies: records.filter((r) => r.type === "allergy").map((r) => r.value),
        medicalHistory: records.filter((r) => r.type === "condition").map((r) => r.value),
        currentMedications: records.filter((r) => r.type === "medication").map((r) => r.value),
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading medical history.", code: "SERVER_ERROR" };
  }
}
// --------------------------- get Apponemnet history --------------------------------------\
export type AppointmentHistoryResult =
  | {
    success: true;
    appointments: {
      id: string;
      startTime: Date;
      endTime: Date;
      status: string;
      treatmentName: string;
      providerName: string;
      noteText: string | null;
      prescription: string | null;
    }[];
    pagination: { total: number; limit: number; offset: number };
  }
  | { success: false; error: string; code: HistoryErrorCode };
export async function getAppointmentHistory(
  patientId: string,
  options?: { limit?: number; offset?: number }
): Promise<AppointmentHistoryResult> {
  try {
    const session = await requireSession();

    const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(options?.offset ?? 0, 0);

    const patient = await db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.orgId, session.orgId)),
    });
    if (!patient) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }

    const whereClause = eq(appointments.patientId, patientId);

    const [results, countResult] = await Promise.all([
      db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          treatmentName: treatments.name,
          providerName: users.name,
          noteText: clinicalNotes.noteText,
          prescription: clinicalNotes.prescription,
        })
        .from(appointments)
        .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
        .innerJoin(users, eq(appointments.providerId, users.id))
        .leftJoin(clinicalNotes, eq(clinicalNotes.appointmentId, appointments.id))
        .where(whereClause)
        .orderBy(desc(appointments.startTime))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    return { success: true, appointments: results, pagination: { total, limit, offset } };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading appointment history.", code: "SERVER_ERROR" };
  }
}