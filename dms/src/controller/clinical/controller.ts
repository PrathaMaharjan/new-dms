import { db } from "@/db";
import {
  appointments,
  clinicalNotes,
  patientMedicalRecords,
  patients,
  treatments,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { and, eq, notExists } from "drizzle-orm";
import z from "zod";

export type ClinicalNoteErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "NOT_FOUND"
  | "DUPLICATE"
  | "SERVER_ERROR";

function getPgErrorCode(err: unknown): string | undefined {
  return (
    (err as { cause?: { code?: string } })?.cause?.code ??
    (err as { code?: string })?.code
  );
}

const saveClinicalEntrySchema = z.object({
  appointmentId: z.string().uuid("Please select a service/procedure"),
  noteText: z.string().optional(),
  prescription: z.string().optional(),
  allergy: z.string().optional(),
  medicalHistory: z.string().optional(),
});

export type SaveClinicalEntryResult =
  | { success: true; noteId: string }
  | { success: false; error: string; code: ClinicalNoteErrorCode };

// Matches the ONE "Save Record" button on this form - the note itself,
// plus any allergy/history typed into those two quick-add fields, all
// saved together in one transaction. Either everything succeeds, or
// nothing does - no risk of a note saving while the allergy silently fails.
export async function saveClinicalEntry(
  patientId: string,
  input: unknown,
): Promise<SaveClinicalEntryResult> {
  try {
    const session = await requireSession();

    const parsed = saveClinicalEntrySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;

    // Confirms the appointment genuinely belongs to THIS patient, at THIS
    // org, before anything gets written.
    const appointment = await db
      .select({ id: appointments.id })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.id, data.appointmentId),
          eq(appointments.patientId, patientId),
          eq(patients.orgId, session.orgId),
        ),
      )
      .limit(1);

    if (appointment.length === 0) {
      return {
        success: false,
        error: "Appointment not found for this patient.",
        code: "NOT_FOUND",
      };
    }

    const noteId = await db.transaction(async (tx) => {
      const [note] = await tx
        .insert(clinicalNotes)
        .values({
          appointmentId: data.appointmentId,
          providerId: session.userId,
          noteText: data.noteText || null,
          prescription: data.prescription || null,
        })
        .returning();
      // Both quick-add fields are optional - only insert if the dentist
      // actually typed something into them.
      if (data.allergy && data.allergy.trim() !== "") {
        await tx.insert(patientMedicalRecords).values({
          patientId,
          type: "allergy",
          value: data.allergy.trim(),
        });
      }

      if (data.medicalHistory && data.medicalHistory.trim() !== "") {
        await tx.insert(patientMedicalRecords).values({
          patientId,
          type: "condition",
          value: data.medicalHistory.trim(),
        });
      }

      return note.id;
    });
    return { success: true, noteId };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return {
        success: false,
        error: "A clinical note already exists for this appointment.",
        code: "DUPLICATE",
      };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong saving the clinical entry.",
      code: "SERVER_ERROR",
    };
  }
}

// Populates the "Service / Procedure" dropdown - kept separate since it's
// a read that runs BEFORE the form is filled out, not part of the save.
// updated NoteableAppointmentsResult and getNoteableAppointments in clinical-notes.controller.ts
export type NoteableAppointmentsResult =
  | {
      success: true;
      appointments: { id: string; treatmentName: string; startTime: Date }[];
      totalAppointmentCount: number; // lets the frontend tell "no appointments" apart from "all documented"
    }
  | { success: false; error: string; code: ClinicalNoteErrorCode };

export async function getNoteableAppointments(patientId: string): Promise<NoteableAppointmentsResult> {
  try {
    const session = await requireSession();

    const [results, totalResult] = await Promise.all([
      db
        .select({
          id: appointments.id,
          treatmentName: treatments.name,
          startTime: appointments.startTime,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
        .where(
          and(
            eq(appointments.patientId, patientId),
            eq(patients.orgId, session.orgId),
            notExists(db.select().from(clinicalNotes).where(eq(clinicalNotes.appointmentId, appointments.id)))
          )
        )
        .orderBy(appointments.startTime),
      db
        .select({ id: appointments.id })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .where(and(eq(appointments.patientId, patientId), eq(patients.orgId, session.orgId))),
    ]);
    return { success: true, appointments: results, totalAppointmentCount: totalResult.length };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading appointments.", code: "SERVER_ERROR" };
  }
}