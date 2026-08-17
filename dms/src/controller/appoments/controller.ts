// src/lib/controllers/appointments.controller.ts
import {
  eq,
  and,
  or,
  ne,
  lt,
  gt,
  gte,
  lte,
  inArray,
  isNull,
  sql,
  desc,
} from "drizzle-orm";
import { db } from "@/db";

import { z } from "zod";
import {
  patients,
  appointments,
  treatments,
  users,
  userLocationRoles,
  providerSchedules,
  locations,
  inventoryMovements,
  inventoryItems,
  treatmentSupplies,
  ledgerEntries,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import {
  assignAppointmentSchema,
  bookAppointmentSchema,
} from "@/lib/validators/appoments";
import {
  sendAppointmentCancelledEmail,
  sendAppointmentConfirmedEmail,
} from "@/lib/email/sendAppomentStatus";
import { checkInventoryEnabled } from "../inventory/inventoryItem/controller";
// import { bookAppointmentSchema } from "@/lib/validators/appointments";

export type BookAppointmentErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "NOT_FOUND"
  | "DOUBLE_BOOKED"
  | "SERVER_ERROR";

const BUFFER_MINUTES = 30;
const BUFFER_MS = BUFFER_MINUTES * 60_000;

export type BookAppointmentResult =
  | {
    success: true;
    appointmentId: string;
    patientId: string;
    wasNewPatient: boolean;
  }
  | { success: false; error: string; code: BookAppointmentErrorCode };

// Schedule-time check disabled for now, on purpose - every active clinical
// staff member at this location counts as a candidate, regardless of
// provider_schedules.
// async function findAvailableDoctor(
//   locationId: string,
//   startTime: Date,
//   endTime: Date
// ): Promise<string | null> {
//   const clinicalStaff = await db
//     .select({ userId: userLocationRoles.userId })
//     .from(userLocationRoles)
//     .innerJoin(users, eq(users.id, userLocationRoles.userId))
//     .where(
//       and(
//         eq(userLocationRoles.locationId, locationId),
//         eq(userLocationRoles.role, "clinical"),
//         eq(users.isActive, true),
//         isNull(users.deletedAt)
//       )
//     );

//   console.log("findAvailableDoctor - locationId used:", locationId);
//   console.log("findAvailableDoctor - clinical candidates found:", clinicalStaff);

//   if (clinicalStaff.length === 0) return null;

//   const candidateIds = clinicalStaff.map((d) => d.userId);

//   const busyDoctors = await db
//     .select({ providerId: appointments.providerId })
//     .from(appointments)
//     .where(
//       and(
//         inArray(appointments.providerId, candidateIds),
//         ne(appointments.status, "cancelled"),
//         lt(appointments.startTime, endTime),
//         gt(appointments.endTime, startTime)
//       )
//     );

//   console.log("findAvailableDoctor - busy doctors at this time:", busyDoctors);

//   const busyIds = new Set(busyDoctors.map((d) => d.providerId));
//   const availableId = candidateIds.find((id) => !busyIds.has(id));

//   console.log("findAvailableDoctor - final result:", availableId ?? null);

//   return availableId ?? null;
// }

function toTimeOfDay(date: Date) {
  return date.toTimeString().slice(0, 8);
}

async function isDoctorScheduledForWindow(params: {
  providerId: string;
  locationId: string;
  startTime: Date;
  endTime: Date;
}) {
  // Weekly schedule model is day-based, so cross-midnight slots cannot be
  // validated against a single day record.
  if (params.startTime.getDay() !== params.endTime.getDay()) {
    return false;
  }

  const dayOfWeek = params.startTime.getDay();
  const startTimeOfDay = toTimeOfDay(params.startTime);
  const endTimeOfDay = toTimeOfDay(params.endTime);

  const scheduled = await db
    .select({ userId: providerSchedules.userId })
    .from(providerSchedules)
    .innerJoin(
      userLocationRoles,
      and(
        eq(userLocationRoles.userId, providerSchedules.userId),
        eq(userLocationRoles.locationId, providerSchedules.locationId),
      ),
    )
    .innerJoin(users, eq(users.id, providerSchedules.userId))
    .where(
      and(
        eq(providerSchedules.userId, params.providerId),
        eq(providerSchedules.locationId, params.locationId),
        eq(providerSchedules.dayOfWeek, dayOfWeek),
        eq(providerSchedules.isOnLeave, false),
        lte(providerSchedules.startTime, startTimeOfDay),
        gte(providerSchedules.endTime, endTimeOfDay),
        eq(userLocationRoles.role, "clinical"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  return scheduled.length > 0;
}

async function findAvailableDoctor(
  locationId: string,
  startTime: Date,
  endTime: Date,
): Promise<string | null> {
  if (startTime.getDay() !== endTime.getDay()) {
    return null;
  }

  const dayOfWeek = startTime.getDay();
  const startTimeOfDay = toTimeOfDay(startTime);
  const endTimeOfDay = toTimeOfDay(endTime);

  // Candidate doctors must be scheduled for the full treatment window.
  const scheduledDoctors = await db
    .select({ userId: providerSchedules.userId })
    .from(providerSchedules)
    .innerJoin(
      userLocationRoles,
      and(
        eq(userLocationRoles.userId, providerSchedules.userId),
        eq(userLocationRoles.locationId, providerSchedules.locationId),
      ),
    )
    .innerJoin(users, eq(users.id, providerSchedules.userId))
    .where(
      and(
        eq(providerSchedules.locationId, locationId),
        eq(providerSchedules.dayOfWeek, dayOfWeek),
        eq(providerSchedules.isOnLeave, false),
        lte(providerSchedules.startTime, startTimeOfDay),
        gte(providerSchedules.endTime, endTimeOfDay),
        eq(userLocationRoles.role, "clinical"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );

  if (scheduledDoctors.length === 0) return null;

  const candidateIds = scheduledDoctors.map((d) => d.userId);

  const busyDoctors = await db
    .select({ providerId: appointments.providerId })
    .from(appointments)
    .where(
      and(
        inArray(appointments.providerId, candidateIds),
        ne(appointments.status, "cancelled"),
        lt(appointments.startTime, new Date(endTime.getTime() + BUFFER_MS)),
        gt(appointments.endTime, new Date(startTime.getTime() - BUFFER_MS)),
      ),
    );

  const busyIds = new Set(busyDoctors.map((d) => d.providerId));
  const availableId = candidateIds.find((id) => !busyIds.has(id));

  return availableId ?? null;
}
export async function bookAppointment(
  input: unknown,
): Promise<BookAppointmentResult> {
  try {
    const session = await requireSession();

    const parsed = bookAppointmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;

    const identifierMatch =
      data.email && data.email.trim() !== ""
        ? or(eq(patients.phone, data.phone), eq(patients.email, data.email))
        : eq(patients.phone, data.phone);

    const [existingPatient, treatment] = await Promise.all([
      db.query.patients.findFirst({
        where: and(eq(patients.orgId, session.orgId), identifierMatch),
      }),
      db.query.treatments.findFirst({
        where: eq(treatments.id, data.treatmentId),
      }),
    ]);

    if (!treatment) {
      return {
        success: false,
        error: "Selected treatment could not be found.",
        code: "NOT_FOUND",
      };
    }

    const startTime = new Date(
      `${data.preferredDate}T${data.preferredTime}:00`,
    );
    const endTime = new Date(
      startTime.getTime() + treatment.durationMinutes * 60_000,
    );

    // console.log("bookAppointment - data.locationId:", data.locationId);
    // console.log("bookAppointment - startTime:", startTime, "endTime:", endTime);

    let providerId = data.providerId;
    if (!providerId) {
      const available = await findAvailableDoctor(
        data.locationId,
        startTime,
        endTime,
      );
      if (!available) {
        return {
          success: false,
          error:
            "No dentist is available at that time. Please choose a different time.",
          code: "DOUBLE_BOOKED",
        };
      }
      providerId = available;
    }

    const isProviderScheduled = await isDoctorScheduledForWindow({
      providerId,
      locationId: data.locationId,
      startTime,
      endTime,
    });

    if (!isProviderScheduled) {
      return {
        success: false,
        error:
          "Selected dentist is not available for the full treatment duration at that time.",
        code: "DOUBLE_BOOKED",
      };
    }

    console.log("bookAppointment - providerId resolved to:", providerId);

    const result = await db.transaction(async (tx) => {
      let patient = existingPatient;
      let wasNewPatient = false;

      if (!patient) {
        const trimmedName = data.fullName.trim();
        const [firstName, ...rest] = trimmedName.split(" ");
        const lastName = rest.join(" ") || "-";

        const [newPatient] = await tx
          .insert(patients)
          .values({
            orgId: session.orgId,
            locationId: data.locationId,
            firstName,
            lastName,
            phone: data.phone,
            email: data.email || null,
            dob: data.dob || null,
          })
          .returning();
        patient = newPatient;
        wasNewPatient = true;
      }

      const conflict = await tx.query.appointments.findFirst({
        where: and(
          eq(appointments.providerId, providerId),
          ne(appointments.status, "cancelled"),
          lt(appointments.startTime, new Date(endTime.getTime() + BUFFER_MS)),
          gt(appointments.endTime, new Date(startTime.getTime() - BUFFER_MS)),
        ),
      });

      console.log("bookAppointment - final conflict check result:", conflict);

      if (conflict) {
        throw new Error("DOUBLE_BOOKED");
      }

      const [appointment] = await tx
        .insert(appointments)
        .values({
          locationId: data.locationId,
          patientId: patient.id,
          providerId,
          treatmentId: data.treatmentId,
          startTime,
          endTime,
          notes: data.notes || null,
          source: "staff",
          status: data.source === "staff" ? "confirmed" : "requested",
        })
        .returning();

      return {
        appointmentId: appointment.id,
        patientId: patient.id,
        wasNewPatient,
      };
    });

    return { success: true, ...result };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (err instanceof Error && err.message === "DOUBLE_BOOKED") {
      return {
        success: false,
        error:
          "This dentist is already booked at that time. Please choose a different time.",
        code: "DOUBLE_BOOKED",
      };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong booking the appointment.",
      code: "SERVER_ERROR",
    };
  }
}

// ---------------get gending appoment --------------------------------
export type PendingReviewResult =
  | {
    success: true;
    appointments: {
      id: string;
      patientName: string;
      patientPhone: string | null;
      patientEmail: string | null;
      treatmentName: string;
      startTime: Date;
      source: string;
      notes: string | null;
    }[];
  }
  | { success: false; error: string; code: BookAppointmentErrorCode };

export async function getPendingAppointments(
  locationId: string,
): Promise<PendingReviewResult> {
  try {
    const session = await requireSession();

    // Same tenant-isolation pattern as getAppointments - scoped through
    // the location, since appointments has no direct orgId column.
    const whereClause = and(
      eq(appointments.locationId, locationId),
      eq(locations.orgId, session.orgId),
      eq(appointments.status, "requested"),
    );

    const results = await db
      .select({
        id: appointments.id,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        patientPhone: patients.phone,
        patientEmail: patients.email,
        treatmentName: treatments.name,
        startTime: appointments.startTime,
        source: appointments.source,
        notes: appointments.notes,
      })
      .from(appointments)
      .innerJoin(locations, eq(appointments.locationId, locations.id))
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .where(whereClause)
      .orderBy(appointments.startTime);

    return { success: true, appointments: results };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading pending appointments.",
      code: "SERVER_ERROR",
    };
  }
}

// ------------------ change status ----------------------------------------
export type UpdateStatusResult =
  | { success: true }
  | { success: false; error: string; code: BookAppointmentErrorCode };

const VALID_STATUSES = [
  "requested",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;

type AppointmentStatus = (typeof VALID_STATUSES)[number];

function isAppointmentStatus(value: string): value is AppointmentStatus {
  return (VALID_STATUSES as readonly string[]).includes(value);
}
async function checkOwnerOrManager(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.isOwner) return true;

  const role = await db.query.userLocationRoles.findFirst({
    where: and(eq(userLocationRoles.userId, userId), eq(userLocationRoles.role, "manager")),
  });
  return !!role;
}
// export async function updateAppointmentStatus(

//   appointmentId: string,
//   status: string,
// ): Promise<UpdateStatusResult> {
//   try {
//     const session = await requireSession();

//     if (!VALID_STATUSES.includes(status)) {
//       return {
//         success: false,
//         error: "Invalid status value.",
//         code: "VALIDATION",
//       };
//     }

//     // Fetches everything an email would need (patient name/email, treatment
//     // name, time) in the SAME query that already confirms ownership - no
//     // separate lookup needed just to build the email later.
//     const [existingAppointment] = await db
//       .select({
//         id: appointments.id,
//         patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
//         patientEmail: patients.email,
//         treatmentName: treatments.name,
//         startTime: appointments.startTime,
//       })
//       .from(appointments)
//       .innerJoin(locations, eq(appointments.locationId, locations.id))
//       .innerJoin(patients, eq(appointments.patientId, patients.id))
//       .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
//       .where(
//         and(
//           eq(appointments.id, appointmentId),
//           eq(locations.orgId, session.orgId),
//         ),
//       )
//       .limit(1);

//     if (!existingAppointment) {
//       return {
//         success: false,
//         error: "Appointment not found.",
//         code: "NOT_FOUND",
//       };
//     }

//     await db
//       .update(appointments)
//       .set({ status: status as any })
//       .where(eq(appointments.id, appointmentId));

//     // Email is deliberately best-effort, AFTER the status change already
//     // succeeded - a flaky email must never roll back or fail an otherwise
//     // successful status update, same reasoning as the doctor welcome email.
//     if (existingAppointment.patientEmail) {
//       try {
//         if (status === "confirmed") {
//           await sendAppointmentConfirmedEmail(
//             existingAppointment.patientEmail,
//             existingAppointment.patientName,
//             existingAppointment.treatmentName,
//             existingAppointment.startTime,
//           );
//         } else if (status === "cancelled") {
//           await sendAppointmentCancelledEmail(
//             existingAppointment.patientEmail,
//             existingAppointment.patientName,
//             existingAppointment.treatmentName,
//             existingAppointment.startTime,
//           );
//         }
//       } catch (emailErr) {
//         console.error(
//           "Appointment status updated, but email failed to send:",
//           emailErr,
//         );
//       }
//     }

//     return { success: true };
//   } catch (err) {
//     if (err instanceof SessionError) {
//       return { success: false, error: err.message, code: "UNAUTHORIZED" };
//     }
//     console.error(err);
//     return {
//       success: false,
//       error: "Something went wrong updating the appointment.",
//       code: "SERVER_ERROR",
//     };
//   }
// }

// ---------------------- assign doctor ------------------------------------


export const updateStatusSchema = z.object({
  status: z.enum(["requested", "confirmed", "checked_in", "completed", "cancelled", "no_show"]),
  forceComplete: z.boolean().optional(),
});



async function ensureCompletionCharge(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  args: {
    appointmentId: string;
    orgId: string;
    locationId: string;
    patientId: string;
    treatmentName: string;
    treatmentPriceCents: number;
  }
) {
  if (args.treatmentPriceCents <= 0) return;

  const existingCharge = await tx
    .select({ id: ledgerEntries.id })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.appointmentId, args.appointmentId),
        eq(ledgerEntries.type, "charge")
      )
    )
    .limit(1);

  if (existingCharge.length > 0) return;

  await tx.insert(ledgerEntries).values({
    orgId: args.orgId,
    locationId: args.locationId,
    patientId: args.patientId,
    appointmentId: args.appointmentId,
    type: "charge",
    amountCents: args.treatmentPriceCents,
    status: "due",
    paymentMethod: null,
    note: `Auto-charged on appointment completion: ${args.treatmentName}`,
  });
}

export async function updateAppointmentStatus(
  appointmentId: string,
  input: unknown
): Promise<UpdateStatusResult> {
  try {
    const session = await requireSession();

    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const { status, forceComplete } = parsed.data;

    if (!VALID_STATUSES.includes(status)) {
      return { success: false, error: "Invalid status value.", code: "VALIDATION" };
    }

    const [existingAppointment] = await db
      .select({
        id: appointments.id,
        currentStatus: appointments.status,
        treatmentId: appointments.treatmentId,
        locationId: appointments.locationId,
        patientId: appointments.patientId,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        patientEmail: patients.email,
        treatmentName: treatments.name,
        treatmentPriceCents: treatments.priceCents,
        startTime: appointments.startTime,
      })
      .from(appointments)
      .innerJoin(locations, eq(appointments.locationId, locations.id))
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .where(and(eq(appointments.id, appointmentId), eq(locations.orgId, session.orgId)))
      .limit(1);

    if (!existingAppointment) {
      return { success: false, error: "Appointment not found.", code: "NOT_FOUND" };
    }

    const isNewCompletion = status === "completed" && existingAppointment.currentStatus !== "completed";

    if (isNewCompletion) {

      const inventoryOn = await checkInventoryEnabled(session.orgId);

      if (!inventoryOn) {
        await db.transaction(async (tx) => {
          await tx.update(appointments).set({ status: "completed" }).where(eq(appointments.id, appointmentId));
          await ensureCompletionCharge(tx, {
            appointmentId: existingAppointment.id,
            orgId: session.orgId,
            locationId: existingAppointment.locationId,
            patientId: existingAppointment.patientId,
            treatmentName: existingAppointment.treatmentName,
            treatmentPriceCents: existingAppointment.treatmentPriceCents,
          });
        });
      } else {
        const supplies = await db
          .select({
            itemId: treatmentSupplies.itemId,
            itemName: inventoryItems.name,
            itemLocationId: inventoryItems.locationId,
            quantityRequired: treatmentSupplies.quantityRequired,
          })
          .from(treatmentSupplies)
          .innerJoin(inventoryItems, eq(treatmentSupplies.itemId, inventoryItems.id))
          .where(eq(treatmentSupplies.treatmentId, existingAppointment.treatmentId));

        if (supplies.length > 0) {
          const itemIds = supplies.map((s) => s.itemId);
          // Sum movements per item WITHOUT filtering by location — the item's
          // own locationId (set when the item was created) is the source of
          // truth for stock. The appointment locationId may be a different UUID
          // even for the same physical clinic, which caused every stock check
          // to return 0 and falsely report a shortage.
          const stockRows = await db
            .select({
              itemId: inventoryMovements.itemId,
              currentStock: sql<number>`coalesce(sum(${inventoryMovements.quantity}), 0)::int`,
            })
            .from(inventoryMovements)
            .where(inArray(inventoryMovements.itemId, itemIds))
            .groupBy(inventoryMovements.itemId);

          const stockByItem = new Map(stockRows.map((r) => [r.itemId, r.currentStock]));
          const shortages = supplies.filter((s) => (stockByItem.get(s.itemId) ?? 0) < s.quantityRequired);

          if (shortages.length > 0) {
            const canOverride = forceComplete && (await checkOwnerOrManager(session.userId));
            if (!canOverride) {
              const shortageList = shortages.map((s) => s.itemName).join(", ");
              return {
                success: false,
                error: `Not enough stock to complete: ${shortageList}. An owner or manager can override this.`,
                code: "VALIDATION",
              };
            }
          }

          await db.transaction(async (tx) => {
            await tx.update(appointments).set({ status: "completed" }).where(eq(appointments.id, appointmentId));
            await tx.insert(inventoryMovements).values(
              supplies.map((s) => ({
                itemId: s.itemId,

                locationId: s.itemLocationId,
                quantity: -s.quantityRequired,
                type: "used" as const,
                note: "Auto-deducted from appointment completion",
                appointmentId: existingAppointment.id,
                recordedByUserId: session.userId,
              }))
            );
            await ensureCompletionCharge(tx, {
              appointmentId: existingAppointment.id,
              orgId: session.orgId,
              locationId: existingAppointment.locationId,
              patientId: existingAppointment.patientId,
              treatmentName: existingAppointment.treatmentName,
              treatmentPriceCents: existingAppointment.treatmentPriceCents,
            });
          });
        } else {
          await db.transaction(async (tx) => {
            await tx.update(appointments).set({ status: "completed" }).where(eq(appointments.id, appointmentId));
            await ensureCompletionCharge(tx, {
              appointmentId: existingAppointment.id,
              orgId: session.orgId,
              locationId: existingAppointment.locationId,
              patientId: existingAppointment.patientId,
              treatmentName: existingAppointment.treatmentName,
              treatmentPriceCents: existingAppointment.treatmentPriceCents,
            });
          });
        }
      }
    } else {
      await db.update(appointments).set({ status }).where(eq(appointments.id, appointmentId));
    }

    if (existingAppointment.patientEmail) {
      try {
        if (status === "confirmed") {
          await sendAppointmentConfirmedEmail(
            existingAppointment.patientEmail,
            existingAppointment.patientName,
            existingAppointment.treatmentName,
            existingAppointment.startTime
          );
        } else if (status === "cancelled") {
          await sendAppointmentCancelledEmail(
            existingAppointment.patientEmail,
            existingAppointment.patientName,
            existingAppointment.treatmentName,
            existingAppointment.startTime
          );
        }
      } catch (emailErr) {
        console.error("Appointment status updated, but email failed to send:", emailErr);
      }
    }

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating the appointment.", code: "SERVER_ERROR" };
  }
}











export type ReassignResult =
  | { success: true }
  | { success: false; error: string; code: BookAppointmentErrorCode };

export async function reassignAppointmentDoctor(
  appointmentId: string,
  newProviderId: string,
): Promise<ReassignResult> {
  try {
    const session = await requireSession();

    const existing = await db
      .select({
        id: appointments.id,
        locationId: appointments.locationId,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
      })
      .from(appointments)
      .innerJoin(locations, eq(appointments.locationId, locations.id))
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(locations.orgId, session.orgId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return {
        success: false,
        error: "Appointment not found.",
        code: "NOT_FOUND",
      };
    }
    const { locationId, startTime, endTime } = existing[0];

    const isProviderScheduled = await isDoctorScheduledForWindow({
      providerId: newProviderId,
      locationId,
      startTime,
      endTime,
    });

    if (!isProviderScheduled) {
      return {
        success: false,
        error:
          "Selected dentist is not available for the full treatment duration at that time.",
        code: "DOUBLE_BOOKED",
      };
    }

    // Same double-booking check as bookAppointment, but explicitly
    // excludes THIS appointment - otherwise it would always "conflict"
    // with itself, since it's already booked against the old provider.
    const conflict = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.providerId, newProviderId),
        ne(appointments.id, appointmentId),
        ne(appointments.status, "cancelled"),
        lt(appointments.startTime, new Date(endTime.getTime() + BUFFER_MS)),
        gt(appointments.endTime, new Date(startTime.getTime() - BUFFER_MS)),
      ),
    });

    if (conflict) {
      return {
        success: false,
        error: "This dentist is already booked at that time.",
        code: "DOUBLE_BOOKED",
      };
    }

    await db
      .update(appointments)
      .set({ providerId: newProviderId })
      .where(eq(appointments.id, appointmentId));
    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong reassigning the appointment.",
      code: "SERVER_ERROR",
    };
  }
}

// get All appment execpt the pending

export type GetAppointmentsResult =
  | {
    success: true;
    appointments: {
      id: string;
      patientName: string;
      patientPhone: string | null;
      patientEmail: string | null;
      patientAge: number | null;
      providerName: string;
      treatmentName: string;
      startTime: Date;
      endTime: Date;
      status: string;
      source: string;
      notes: string | null;
    }[];
    pagination: { total: number; limit: number; offset: number };
  }
  | { success: false; error: string; code: BookAppointmentErrorCode };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function getAppointments(
  locationId: string,
  options?: { status?: string; date?: string; limit?: number; offset?: number },
): Promise<GetAppointmentsResult> {
  try {
    const session = await requireSession();
    console.log(
      "getAppointments called with locationId:",
      JSON.stringify(locationId),
    );

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(options?.offset ?? 0, 0);

    const conditions = [
      eq(appointments.locationId, locationId),
      eq(locations.orgId, session.orgId),
      ne(appointments.status, "requested"),
    ];
    if (options?.status && isAppointmentStatus(options.status)) {
      conditions.push(eq(appointments.status, options.status));
    }
    if (options?.date) {
      const dayStart = new Date(`${options.date}T00:00:00`);
      const dayEnd = new Date(`${options.date}T23:59:59`);
      conditions.push(gt(appointments.startTime, dayStart));
      conditions.push(lt(appointments.startTime, dayEnd));
    }
    const whereClause = and(...conditions);

    const [results, countResult] = await Promise.all([
      db
        .select({
          id: appointments.id,
          patientId: appointments.patientId,
          patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
          patientPhone: patients.phone,
          patientEmail: patients.email,
          patientAge: patients.age,
          providerId: appointments.providerId,
          providerName: users.name,
          treatmentId: appointments.treatmentId,
          treatmentName: treatments.name,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          source: appointments.source,
          notes: appointments.notes,
        })
        .from(appointments)
        .innerJoin(locations, eq(appointments.locationId, locations.id))
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(users, eq(appointments.providerId, users.id))
        .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
        .where(whereClause)
        .orderBy(desc(appointments.startTime))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .innerJoin(locations, eq(appointments.locationId, locations.id))
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      success: true,
      appointments: results,
      pagination: { total, limit, offset },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading appointments.",
      code: "SERVER_ERROR",
    };
  }
}

// -----------------------get dingle appoment ----------------------------
export type GetAppointmentResult =
  | {
    success: true;
    appointment: {
      id: string;
      patientId: string;
      patientName: string;
      patientPhone: string | null;
      patientEmail: string | null;
      providerId: string;
      providerName: string;
      treatmentId: string;
      treatmentName: string;
      startTime: Date;
      endTime: Date;
      status: string;
      source: string;
      notes: string | null;
    };
  }
  | { success: false; error: string; code: BookAppointmentErrorCode };

export async function getAppointment(
  appointmentId: string,
): Promise<GetAppointmentResult> {
  try {
    const session = await requireSession();

    const [result] = await db
      .select({
        id: appointments.id,
        patientId: patients.id,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        patientPhone: patients.phone,
        patientEmail: patients.email,
        providerId: users.id,
        providerName: users.name,
        treatmentId: treatments.id,
        treatmentName: treatments.name,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        source: appointments.source,
        notes: appointments.notes,
      })
      .from(appointments)
      .innerJoin(locations, eq(appointments.locationId, locations.id))
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(appointments.providerId, users.id))
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(locations.orgId, session.orgId),
        ),
      )
      .limit(1);
    if (!result) {
      return {
        success: false,
        error: "Appointment not found.",
        code: "NOT_FOUND",
      };
    }
    return { success: true, appointment: result };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the appointment.",
      code: "SERVER_ERROR",
    };
  }
}

// ------------------assigned appoment to the existing patent --------------------------------

export type AssignAppointmentResult =
  | { success: true; appointmentId: string }
  | { success: false; error: string; code: BookAppointmentErrorCode };

export async function assignAppointmentToPatient(
  input: unknown,
): Promise<AssignAppointmentResult> {
  try {
    const session = await requireSession();

    const parsed = assignAppointmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;
    const patient = await db.query.patients.findFirst({
      where: and(
        eq(patients.id, data.patientId),
        eq(patients.orgId, session.orgId),
        isNull(patients.deletedAt),
      ),
    });

    if (!patient) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }
    const treatment = await db.query.treatments.findFirst({
      where: eq(treatments.id, data.treatmentId),
    });
    if (!treatment) {
      return {
        success: false,
        error: "Selected treatment could not be found.",
        code: "NOT_FOUND",
      };
    }

    const startTime = new Date(
      `${data.preferredDate}T${data.preferredTime}:00`,
    );
    const endTime = new Date(
      startTime.getTime() + treatment.durationMinutes * 60_000,
    );
    let providerId = data.providerId;
    if (!providerId) {
      const available = await findAvailableDoctor(
        data.locationId,
        startTime,
        endTime,
      );
      if (!available) {
        return {
          success: false,
          error:
            "No dentist is available at that time. Please choose a different time.",
          code: "DOUBLE_BOOKED",
        };
      }
      providerId = available;
    }

    const isProviderScheduled = await isDoctorScheduledForWindow({
      providerId,
      locationId: data.locationId,
      startTime,
      endTime,
    });

    if (!isProviderScheduled) {
      return {
        success: false,
        error:
          "Selected dentist is not available for the full treatment duration at that time.",
        code: "DOUBLE_BOOKED",
      };
    }

    const conflict = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.providerId, providerId),
        ne(appointments.status, "cancelled"),
        lt(appointments.startTime, new Date(endTime.getTime() + BUFFER_MS)),
        gt(appointments.endTime, new Date(startTime.getTime() - BUFFER_MS)),
      ),
    });
    if (conflict) {
      return {
        success: false,
        error:
          "This dentist is already booked at that time. Please choose a different time.",
        code: "DOUBLE_BOOKED",
      };
    }
    const [appointment] = await db
      .insert(appointments)
      .values({
        locationId: data.locationId,
        patientId: data.patientId,
        providerId,
        status: "confirmed",
        treatmentId: data.treatmentId,
        startTime,
        endTime,
        notes: data.notes || null,
        source: "staff",
      })
      .returning();
    return { success: true, appointmentId: appointment.id };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong booking the appointment.",
      code: "SERVER_ERROR",
    };
  }
}

// ------------------------- update appointment -----------------------------

const updateAppointmentSchema = z.object({
  patientName: z.string().min(1).optional(),
  patientPhone: z.string().min(1).optional(),
  treatmentId: z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
  status: z
    .enum([
      "requested",
      "confirmed",
      "checked_in",
      "completed",
      "cancelled",
      "no_show",
    ])
    .optional(),
  date: z.string().optional(), // YYYY-MM-DD
  time: z.string().optional(), // HH:MM
  notes: z.string().optional(),
});

export type UpdateAppointmentResult =
  | { success: true }
  | { success: false; error: string; code: BookAppointmentErrorCode };

export async function updateAppointment(
  appointmentId: string,
  input: unknown,
): Promise<UpdateAppointmentResult> {
  try {
    const session = await requireSession();

    const parsed = updateAppointmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;

    const existing = await db
      .select({
        id: appointments.id,
        locationId: appointments.locationId,
        patientId: appointments.patientId,
        providerId: appointments.providerId,
        treatmentId: appointments.treatmentId,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
      })
      .from(appointments)
      .innerJoin(locations, eq(appointments.locationId, locations.id))
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(locations.orgId, session.orgId),
        ),
      )
      .limit(1);

    const current = existing[0];
    if (!current) {
      return {
        success: false,
        error: "Appointment not found.",
        code: "NOT_FOUND",
      };
    }

    // Resolve which treatment's duration to use - the newly chosen one,
    // or whatever's already on the appointment if it isn't changing.
    const treatmentId = data.treatmentId ?? current.treatmentId;
    const treatment = await db.query.treatments.findFirst({
      where: eq(treatments.id, treatmentId),
    });
    if (!treatment) {
      return {
        success: false,
        error: "Selected treatment could not be found.",
        code: "NOT_FOUND",
      };
    }

    // Which doctor this appointment will actually belong to after saving.
    const providerId = data.providerId ?? current.providerId;

    // Recompute AND re-check for conflicts whenever the treatment (its
    // duration changes the end time), the date/time, or the provider
    // itself changes - not just date/time. A treatment swap alone can
    // silently lengthen or shorten the slot and must be re-validated too.
    let startTime = current.startTime;
    let endTime = current.endTime;

    const dateOrTimeChanged =
      data.date !== undefined || data.time !== undefined;
    const treatmentChanged = data.treatmentId !== undefined;
    const providerChanged = data.providerId !== undefined;

    if (dateOrTimeChanged || treatmentChanged || providerChanged) {
      const existingDate = current.startTime.toISOString().slice(0, 10);
      const existingTime = current.startTime.toTimeString().slice(0, 5);
      const nextDate = data.date ?? existingDate;
      const nextTime = data.time ?? existingTime;

      startTime = new Date(`${nextDate}T${nextTime}:00`);
      endTime = new Date(
        startTime.getTime() + treatment.durationMinutes * 60_000,
      );

      const isProviderScheduled = await isDoctorScheduledForWindow({
        providerId,
        locationId: current.locationId,
        startTime,
        endTime,
      });

      if (!isProviderScheduled) {
        return {
          success: false,
          error:
            "Selected dentist is not available for the full treatment duration at that time.",
          code: "DOUBLE_BOOKED",
        };
      }

      // Same double-booking guard as reassignAppointmentDoctor - exclude
      // this appointment, since it's already booked against itself.
      const conflict = await db.query.appointments.findFirst({
        where: and(
          eq(appointments.providerId, providerId),
          ne(appointments.id, appointmentId),
          ne(appointments.status, "cancelled"),
          lt(appointments.startTime, new Date(endTime.getTime() + BUFFER_MS)),
          gt(appointments.endTime, new Date(startTime.getTime() - BUFFER_MS)),
        ),
      });
      if (conflict) {
        return {
          success: false,
          error: "This dentist is already booked at that time.",
          code: "DOUBLE_BOOKED",
        };
      }
    }

    await db.transaction(async (tx) => {
      if (data.patientName || data.patientPhone) {
        const patientUpdates: Record<string, string> = {};
        if (data.patientName) {
          const trimmed = data.patientName.trim();
          const [firstName, ...rest] = trimmed.split(" ");
          patientUpdates.firstName = firstName;
          patientUpdates.lastName = rest.join(" ") || "-";
        }
        if (data.patientPhone) {
          patientUpdates.phone = data.patientPhone;
        }
        await tx
          .update(patients)
          .set(patientUpdates)
          .where(eq(patients.id, current.patientId));
      }

      await tx
        .update(appointments)
        .set({
          treatmentId,
          providerId,
          startTime,
          endTime,
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        })
        .where(eq(appointments.id, appointmentId));
    });

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong updating the appointment.",
      code: "SERVER_ERROR",
    };
  }
}

// ------------------------- delete appointment ------------------------------

export type DeleteAppointmentResult =
  | { success: true }
  | { success: false; error: string; code: BookAppointmentErrorCode };

export async function deleteAppointment(
  appointmentId: string,
): Promise<DeleteAppointmentResult> {
  try {
    const session = await requireSession();

    const existing = await db
      .select({ id: appointments.id })
      .from(appointments)
      .innerJoin(locations, eq(appointments.locationId, locations.id))
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(locations.orgId, session.orgId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return {
        success: false,
        error: "Appointment not found.",
        code: "NOT_FOUND",
      };
    }

    // Genuine hard delete - will fail with a foreign key error if this
    // appointment has clinical_notes or ledger_entries attached, since
    // those were deliberately left un-cascaded to protect medical/billing
    // history. That failure is correct behavior, not a bug to route around.
    await db.delete(appointments).where(eq(appointments.id, appointmentId));

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong deleting the appointment.",
      code: "SERVER_ERROR",
    };
  }
}
