import { db } from "@/db";
import { appointments, locations, treatments, users } from "@/db/schema";
import {
  PatientSessionError,
  requirePatientSession,
} from "@/lib/auth/get-patient-seesion";
import { and, desc, eq, gte, lt, ne } from "drizzle-orm";
import z from "zod";

export type UpcomingAppointment = {
  id: string;
  treatmentName: string;
  startTime: Date;
  doctorName: string;
  locationName: string;
  canModify: boolean;
};

export type UpcomingAppointmentResult =
  | { success: true; appointment: UpcomingAppointment | null }
  | { success: false; error: string };

const MIN_NOTICE_HOURS = 24;

export async function getMyUpcomingAppointment(): Promise<UpcomingAppointmentResult> {
  try {
    const session = await requirePatientSession();
    const now = new Date();

    const appointment = await db
      .select({
        id: appointments.id,
        treatmentName: treatments.name,
        startTime: appointments.startTime,
        doctorName: users.name,
        locationName: locations.name,
      })
      .from(appointments)
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .innerJoin(users, eq(appointments.providerId, users.id))
      .innerJoin(locations, eq(appointments.locationId, locations.id))
      .where(
        and(
          eq(appointments.patientId, session.patientId),
          gte(appointments.startTime, now),
          ne(appointments.status, "cancelled"),
          ne(appointments.status, "completed"),
        ),
      )
      .orderBy(appointments.startTime)
      .limit(1);

    if (appointment.length === 0) {
      return { success: true, appointment: null };
    }

    const row = appointment[0];
    const hoursUntil =
      (row.startTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    return {
      success: true,
      appointment: { ...row, canModify: hoursUntil >= MIN_NOTICE_HOURS },
    };
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading your upcoming appointment.",
    };
  }
}

export type PastVisit = {
  id: string;
  treatmentName: string;
  startTime: Date;
  doctorName: string;
};

export type PastVisitsResult =
  | { success: true; visits: PastVisit[] }
  | { success: false; error: string };

export async function getMyPastVisits(): Promise<PastVisitsResult> {
  try {
    const session = await requirePatientSession();
    const now = new Date();

    const visits = await db
      .select({
        id: appointments.id,
        treatmentName: treatments.name,
        startTime: appointments.startTime,
        doctorName: users.name,
      })
      .from(appointments)
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .innerJoin(users, eq(appointments.providerId, users.id))
      .where(
        and(
          eq(appointments.patientId, session.patientId),
          lt(appointments.startTime, now),
          eq(appointments.status, "completed"),
        ),
      )
      .orderBy(desc(appointments.startTime));

    return { success: true, visits };
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading your visit history.",
    };
  }
}

export type CancelResult =
  | { success: true }
  | { success: false; error: string };

export async function cancelMyAppointment(
  appointmentId: string,
): Promise<CancelResult> {
  try {
    const session = await requirePatientSession();

    const appointment = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.id, appointmentId),
        eq(appointments.patientId, session.patientId),
      ),
    });
    if (!appointment) {
      return { success: false, error: "Appointment not found." };
    }

    const hoursUntil =
      (appointment.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < MIN_NOTICE_HOURS) {
      return {
        success: false,
        error: `Appointments can only be cancelled at least ${MIN_NOTICE_HOURS} hours in advance. Please call the clinic directly.`,
      };
    }

    await db
      .update(appointments)
      .set({ status: "cancelled" })
      .where(eq(appointments.id, appointmentId));
    return { success: true };
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong cancelling your appointment.",
    };
  }
}

// reshulding
const rescheduleSchema = z.object({
  newStartTime: z
    .string()
    .refine(
      (v) => !isNaN(new Date(v).getTime()),
      "Please provide a valid date and time",
    ),
});

// reschedule

export type RescheduleResult =
  | { success: true }
  | { success: false; error: string };
export async function rescheduleMyAppointment(
  appointmentId: string,
  input: unknown,
): Promise<RescheduleResult> {
  try {
    const session = await requirePatientSession();

    const parsed = rescheduleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
      };
    }

    const appointment = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.id, appointmentId),
        eq(appointments.patientId, session.patientId),
      ),
    });
    if (!appointment) {
      return { success: false, error: "Appointment not found." };
    }

    const hoursUntil =
      (appointment.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < MIN_NOTICE_HOURS) {
      return {
        success: false,
        error: `Appointments can only be rescheduled at least ${MIN_NOTICE_HOURS} hours in advance. Please call the clinic directly.`,
      };
    }

    const newStartTime = new Date(parsed.data.newStartTime);
    if (newStartTime.getTime() <= Date.now()) {
      return { success: false, error: "Please choose a future date and time." };
    }

    const treatment = await db.query.treatments.findFirst({
      where: eq(treatments.id, appointment.treatmentId),
    });
    const newEndTime = new Date(
      newStartTime.getTime() + (treatment?.durationMinutes ?? 30) * 60_000,
    );

    const conflict = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.providerId, appointment.providerId),
        ne(appointments.id, appointmentId),
        ne(appointments.status, "cancelled"),
        lt(appointments.startTime, newEndTime),
        gte(appointments.endTime, newStartTime),
      ),
    });
    if (conflict) {
      return {
        success: false,
        error:
          "This doctor is not available at the requested time. Please choose a different time.",
      };
    }

    // Moving an already-confirmed appointment back into review, rather
    // than trusting the patient's new time unconditionally - staff gets
    // a chance to confirm the new slot actually works before it's final.
    await db
      .update(appointments)
      .set({
        startTime: newStartTime,
        endTime: newEndTime,
        status: "requested",
      })
      .where(eq(appointments.id, appointmentId));

    return { success: true };
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong rescheduling your appointment.",
    };
  }
}

// doctor Avaiable

import { startOfDay, endOfDay } from "date-fns"; // or your existing date helpers

export type AvailableSlot = { time: string; label: string }; // "14:00", "2:00 PM"

export type AvailableSlotsResult =
  | { success: true; slots: AvailableSlot[] }
  | { success: false; error: string };

const CLINIC_OPEN_HOUR = 9; // 9 AM
const CLINIC_CLOSE_HOUR = 18; // 6 PM
const SLOT_MINUTES = 30;

export async function getDoctorAvailableSlots(
  appointmentId: string,
  dateString: string, // "2026-09-15"
): Promise<AvailableSlotsResult> {
  try {
    const session = await requirePatientSession();
    const appointment = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.id, appointmentId),
        eq(appointments.patientId, session.patientId),
      ),
    });
    if (!appointment) {
      return { success: false, error: "Appointment not found." };
    }

    const treatment = await db.query.treatments.findFirst({
      where: eq(treatments.id, appointment.treatmentId),
    });
    const durationMinutes = treatment?.durationMinutes ?? 30;

    const targetDate = new Date(dateString);
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    const existingAppointments = await db
      .select({
        startTime: appointments.startTime,
        endTime: appointments.endTime,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.providerId, appointment.providerId),
          ne(appointments.id, appointmentId),
          ne(appointments.status, "cancelled"),
          gte(appointments.startTime, dayStart),
          lt(appointments.startTime, dayEnd),
        ),
      );
    const slots: AvailableSlot[] = [];
    const now = new Date();

    for (let hour = CLINIC_OPEN_HOUR; hour < CLINIC_CLOSE_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
        const slotStart = new Date(targetDate);
        slotStart.setHours(hour, minute, 0, 0);
        const slotEnd = new Date(
          slotStart.getTime() + durationMinutes * 60_000,
        );

        if (
          slotEnd.getHours() > CLINIC_CLOSE_HOUR ||
          (slotEnd.getHours() === CLINIC_CLOSE_HOUR && slotEnd.getMinutes() > 0)
        ) {
          continue; // this slot would run past closing time
        }
        if (slotStart <= now) {
          continue; // already in the past
        }

        const overlaps = existingAppointments.some(
          (a) => slotStart < a.endTime && slotEnd > a.startTime,
        );
        if (overlaps) continue;

        slots.push({
          time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
          label: slotStart.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          }),
        });
      }
    }
    return { success: true, slots };
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading available times.",
    };
  }
}
