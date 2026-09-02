import {
  getFullHistoryData,
  getVisitReportData,
} from "@/controller/patient-reports/controller";
import { db } from "@/db";
import { appointments, locations, organizations, patients } from "@/db/schema";
import {
  PatientSessionError,
  requirePatientSession,
} from "@/lib/auth/get-patient-seesion";
import { imagePresets } from "@/lib/cloudinary/storage";
import { generateFullHistoryPdf } from "@/lib/pdfReport/generateFullHistory";
import { generateVisitReportPdf } from "@/lib/pdfReport/generateVisitReportPdf";
import { and, eq } from "drizzle-orm";

export type DownloadReportResult =
  | { success: true; pdfBuffer: Buffer; filename: string }
  | { success: false; error: string };

export async function getMyLatestVisitReportPdf(): Promise<DownloadReportResult> {
  try {
    const session = await requirePatientSession();

    const latestAppointment = await db.query.appointments.findFirst({
      where: and(eq(appointments.patientId, session.patientId), eq(appointments.status, "completed")),
      orderBy: (a, { desc }) => [desc(a.startTime)],
    });
    if (!latestAppointment) {
      return { success: false, error: "You don't have any completed visits yet." };
    }

    const reportResult = await getVisitReportData(session.patientId, latestAppointment.id, session.orgId); // CHANGED - orgId passed explicitly
    if (!reportResult.success) {
      return { success: false, error: reportResult.error };
    }

    const pdfBuffer = await generateVisitReportPdf(reportResult.data);
    return { success: true, pdfBuffer, filename: "visit-report.pdf" };
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return { success: false, error: "Something went wrong generating your report." };
  }
}

// get history data

export async function getMyFullHistoryPdf(): Promise<DownloadReportResult> {
  try {
    const session = await requirePatientSession();

    const historyResult = await getFullHistoryData(session.patientId, session.orgId); // CHANGED - orgId passed explicitly
    if (!historyResult.success) {
      return { success: false, error: historyResult.error };
    }

    const patient = await db.query.patients.findFirst({ where: eq(patients.id, session.patientId) });
    if (!patient) {
      return { success: false, error: "Patient not found." };
    }

    const [clinicRow] = await db
      .select({
        clinicName: organizations.name,
        clinicAddress: locations.address,
        clinicPhone: locations.phone,
        clinicEmail: locations.email,
        clinicLogoUrl: organizations.photoUrl,
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
      logoUrl: clinicRow?.clinicLogoUrl ? imagePresets.thumbnail(clinicRow.clinicLogoUrl) : null,
    };

    const pdfBuffer = await generateFullHistoryPdf(historyResult.data, clinic);
    return { success: true, pdfBuffer, filename: "medical-history.pdf" };
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return { success: false, error: "Something went wrong generating your history." };
  }
}