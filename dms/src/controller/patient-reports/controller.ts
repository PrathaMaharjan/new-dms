// src/lib/controllers/patient-reports.controller.ts
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  patients,
  treatments,
  users,
  clinicalNotes,
  patientMedicalRecords,
  organizations,
  locations,
  providerProfiles,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import z from "zod";
import { generateVisitReportPdf } from "@/lib/pdfReport/generateVisitReportPdf";
import { sendPatientReportEmail } from "@/lib/email/sendPatientReportEmail";
import { generateFullHistoryPdf } from "@/lib/pdfReport/generateFullHistory";

export type ReportErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "SERVER_ERROR";

export type VisitReportData = {
  appointmentId: string;
  patientName: string;
  patientEmail: string | null;
  patientPhone: string | null;
  patientDob: string | null;
  patientGender: string | null;
  doctorName: string;
  doctorQualification: string | null;
  treatmentName: string;
  startTime: Date;
  noteText: string | null;
  prescription: string | null;
  clinicName: string;
  clinicAddress: string | null;
  clinicPhone: string | null;
  clinicEmail: string | null;
};

export type GetVisitReportDataResult =
  | { success: true; data: VisitReportData }
  | { success: false; error: string; code: ReportErrorCode };

// Confirms the appointment genuinely belongs to THIS patient, at THIS
// clinic, before pulling anything - same ownership pattern used
// everywhere else that touches clinical data.


// get history
export type FullHistoryData = {
  patientName: string;
  patientEmail: string | null;
  dob: string | null;
  gender: string | null;
  bloodGroup: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  visits: {
    date: Date;
    doctorName: string;
    treatmentName: string;
    status: string;
    noteText: string | null;
    prescription: string | null;
  }[];
};


export async function getVisitReportData(patientId: string, appointmentId: string): Promise<GetVisitReportDataResult> {
  try {
    const session = await requireSession();

    const [row] = await db
      .select({
        appointmentId: appointments.id,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        patientEmail: patients.email,
        patientPhone: patients.phone,
        patientDob: patients.dob,
        patientGender: patients.gender,
        doctorName: users.name,
        doctorQualification: providerProfiles.qualification,
        treatmentName: treatments.name,
        startTime: appointments.startTime,
        noteText: clinicalNotes.noteText,
        prescription: clinicalNotes.prescription,
        clinicName: organizations.name,
        clinicAddress: locations.address,
        clinicPhone: locations.phone,
        clinicEmail: locations.email,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(appointments.providerId, users.id))
      .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .innerJoin(locations, eq(appointments.locationId, locations.id))
      .innerJoin(organizations, eq(locations.orgId, organizations.id))
      .leftJoin(clinicalNotes, eq(clinicalNotes.appointmentId, appointments.id))
      .where(and(eq(appointments.id, appointmentId), eq(appointments.patientId, patientId), eq(patients.orgId, session.orgId)))
      .limit(1);

    if (!row) {
      return { success: false, error: "Appointment not found for this patient.", code: "NOT_FOUND" };
    }
    return { success: true, data: row };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the visit report.", code: "SERVER_ERROR" };
  }
}

export type GetFullHistoryResult =
  | { success: true; data: FullHistoryData }
  | { success: false; error: string; code: ReportErrorCode };
export async function getFullHistoryData(patientId: string): Promise<GetFullHistoryResult> {
  try {
    const session = await requireSession();

    const patient = await db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.orgId, session.orgId)),
    });
    if (!patient) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }

    const [medicalRecords, visits] = await Promise.all([
      db
        .select({ type: patientMedicalRecords.type, value: patientMedicalRecords.value })
        .from(patientMedicalRecords)
        .where(eq(patientMedicalRecords.patientId, patientId)),
      db
        .select({
          date: appointments.startTime,
          doctorName: users.name,
          treatmentName: treatments.name,
          status: appointments.status,
          noteText: clinicalNotes.noteText,
          prescription: clinicalNotes.prescription,
          // followUpInstructions removed - not a real column, folded
          // into noteText, matching the single-field decision made for
          // the visit report.
        })
        .from(appointments)
        .innerJoin(users, eq(appointments.providerId, users.id))
        .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
        .leftJoin(clinicalNotes, eq(clinicalNotes.appointmentId, appointments.id))
        .where(eq(appointments.patientId, patientId))
        .orderBy(appointments.startTime),
    ]);

    return {
      success: true,
      data: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientEmail: patient.email,
        dob: patient.dob,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        allergies: medicalRecords.filter((r) => r.type === "allergy").map((r) => r.value),
        conditions: medicalRecords.filter((r) => r.type === "condition").map((r) => r.value),
        medications: medicalRecords.filter((r) => r.type === "medication").map((r) => r.value),
        visits,
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the medical history.", code: "SERVER_ERROR" };
  }
}


// actually teggier
const sendVisitReportSchema = z.object({
  appointmentId: z.string().uuid("Missing or invalid appointment"),
});

export type SendReportResult = { success: true } | { success: false; error: string; code: ReportErrorCode };
export async function sendVisitReport(patientId: string, input: unknown): Promise<SendReportResult> {
  try {
    await requireSession();

    const parsed = sendVisitReportSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }

    const reportResult = await getVisitReportData(patientId, parsed.data.appointmentId);
    if (!reportResult.success) return reportResult;

    if (!reportResult.data.patientEmail) {
      return { success: false, error: "This patient has no email on file.", code: "VALIDATION" };
    }
        const pdfBuffer = await generateVisitReportPdf(reportResult.data);
    await sendPatientReportEmail(
      reportResult.data.patientEmail,
      reportResult.data.patientName,
      "Visit Report",
      pdfBuffer,
      "visit-report.pdf"
    );

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong sending the visit report.", code: "SERVER_ERROR" };
  }
}


export async function sendFullHistoryReport(patientId: string): Promise<SendReportResult> {
  try {
    const session = await requireSession();

    const historyResult = await getFullHistoryData(patientId);
    if (!historyResult.success) return historyResult;

    if (!historyResult.data.patientEmail) {
      return { success: false, error: "This patient has no email on file.", code: "VALIDATION" };
    }

    // getFullHistoryData never joins through locations/organizations -
    // fetched separately here, same shape getVisitReportData already
    // pulls inline, since generateFullHistoryPdf needs it as its own arg.
    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, patientId),
    });
    if (!patient) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }

    const [clinicRow] = await db
      .select({
        clinicName: organizations.name,
        clinicAddress: locations.address,
        clinicPhone: locations.phone,
        clinicEmail: locations.email,
      })
      .from(locations)
      .innerJoin(organizations, eq(locations.orgId, organizations.id))
      .where(and(eq(locations.id, patient.locationId), eq(locations.orgId, session.orgId)))
      .limit(1);

    const clinic = {
      name: clinicRow?.clinicName ?? "Clinic",
      address: clinicRow?.clinicAddress ?? null,
      phone: clinicRow?.clinicPhone ?? null,
      email: clinicRow?.clinicEmail ?? null,
    };

    const pdfBuffer = await generateFullHistoryPdf(historyResult.data, clinic);
    await sendPatientReportEmail(
      historyResult.data.patientEmail,
      historyResult.data.patientName,
      "Full Medical History",
      pdfBuffer,
      "medical-history.pdf"
    );

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong sending the medical history.", code: "SERVER_ERROR" };
  }
}