import { db } from "@/db";
import {
  appointments,
  appointmentTypes,
  doctorTreatments,
  locations,
  organizations,
  patients,
  providerProfiles,
  providerSchedules,
  treatments,
  userLocationRoles,
  users,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { hashPassword } from "@/lib/auth/hash";
import { imagePresets } from "@/lib/cloudinary/storage";
import { sendStaffWelcomeEmail } from "@/lib/email/sendWelComeMail";
import {
  createDoctorSchema,
  updateDoctorSchema,
  UpdateScheduleInput,
  updateScheduleSchema,
} from "@/lib/validators/doctor";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

export type DoctorErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "NOT_FOUND"
  | "DUPLICATE"
  | "SERVER_ERROR";

let hasEnsuredDoctorTreatmentsTable = false;
export async function ensureDoctorTreatmentsTable() {
  if (hasEnsuredDoctorTreatmentsTable) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS doctor_treatments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        treatment_id uuid NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT now() NOT NULL,
        CONSTRAINT doctor_treatments_doctor_treatment_unique UNIQUE (doctor_id, treatment_id)
      );
      CREATE INDEX IF NOT EXISTS doctor_treatments_doctor_id_idx ON doctor_treatments(doctor_id);
      CREATE INDEX IF NOT EXISTS doctor_treatments_treatment_id_idx ON doctor_treatments(treatment_id);
    `);
    hasEnsuredDoctorTreatmentsTable = true;
  } catch (e) {
    // Ignore if already created or race condition
  }
}

function getPgErrorCode(err: unknown): string | undefined {
  return (
    (err as { cause?: { code?: string } })?.cause?.code ??
    (err as { code?: string })?.code
  );
}

// Confirms a user is both (a) a real staff member/doctor and (b) belongs
// to the caller's own org - the same two-part check used for Treatments.
async function findOwnedDoctor(doctorId: string, orgId: string) {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(users)
    .where(
      and(
        eq(users.id, doctorId),
        eq(users.orgId, orgId),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type CreateDoctorResult =
  | {
      success: true;
      doctor: {
        id: string;
        name: string;
        email: string;
        photoUrl: string | null;
      };
      emailSent: boolean;
    }
  | { success: false; error: string; code: DoctorErrorCode };

export async function createDoctor(
  input: unknown,
): Promise<CreateDoctorResult> {
  try {
    const session = await requireSession();
    await ensureDoctorTreatmentsTable();

    const parsed = createDoctorSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;

    const [location, org] = await Promise.all([
      db.query.locations.findFirst({
        where: and(
          eq(locations.id, data.locationId),
          eq(locations.orgId, session.orgId),
        ),
      }),
      db.query.organizations.findFirst({
        where: eq(organizations.id, session.orgId),
      }),
    ]);

    if (!location) {
      return {
        success: false,
        error: "Location not found.",
        code: "NOT_FOUND",
      };
    }
    if (!org) {
      return {
        success: false,
        error: "Organization not found.",
        code: "NOT_FOUND",
      };
    }

    const passwordHash = await hashPassword(data.password);
    const createdUser = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          orgId: session.orgId,
          email: data.email,
          phone: data.phone,
          passwordHash,
          name: data.name,
        })
        .returning();

      await tx.insert(userLocationRoles).values({
        userId: user.id,
        locationId: data.locationId,
        role: "clinical",
      });

      await tx.insert(providerProfiles).values({
        userId: user.id,
        photoUrl: data.photoKey,
        specialization: data.specialization,
        qualification: data.qualification,
        education: data.education,
        bio: data.bio,
        yearsOfExperience: data.yearsOfExperience,
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth : null,
        bloodGroup: data.bloodGroup,
        gender: data.gender,
        address: data.address,
        employmentType: data.employmentType,
      });

      if (data.treatmentIds && data.treatmentIds.length > 0) {
        await tx.insert(doctorTreatments).values(
          data.treatmentIds.map((treatmentId) => ({
            doctorId: user.id,
            treatmentId,
          })),
        );
      }

      return user;
    });
    let emailSent = true;
    try {
      await sendStaffWelcomeEmail(
        data.email,
        data.name,
        data.password,
        org.name,
        "Clinical",
      );
    } catch (emailErr) {
      console.error(
        "Doctor created, but welcome email failed to send:",
        emailErr,
      );
      emailSent = false;
    }

    return {
      success: true,
      doctor: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        photoUrl: imagePresets.thumbnail(data.photoKey ?? null),
      },
      emailSent,
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      const constraint =
        (err as { cause?: { constraint?: string } })?.cause?.constraint ?? "";
      if (constraint.includes("phone")) {
        return {
          success: false,
          error: "A staff member with this phone number already exists.",
          code: "DUPLICATE",
        };
      }
      return {
        success: false,
        error: "A staff member with this email already exists.",
        code: "DUPLICATE",
      };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong creating the doctor.",
      code: "SERVER_ERROR",
    };
  }
}

// ----------------------------------get doctor ------------------------------------------
export type GetDoctorsResult =
  | {
      success: true;
      doctors: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        photoUrl: string | null;
        specialization: string | null;
        qualification: string | null;
        education: string | null;
        bio: string | null;
        yearsOfExperience: number | null;
        dateOfBirth: string | null;
        bloodGroup: string | null;
        gender: string | null;
        address: string | null;
        patientsCheckedUp?: number;
        treatmentIds?: string[];
        treatments?: { id: string; name: string }[];
      }[];
      pagination: { total: number; limit: number; offset: number };
    }
  | { success: false; error: string; code: DoctorErrorCode };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
export async function getDoctors(
  locationId?: string,
  options?: { limit?: number; offset?: number },
): Promise<GetDoctorsResult> {
  try {
    const session = await requireSession();
    await ensureDoctorTreatmentsTable();

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(options?.offset ?? 0, 0);

    const whereClause = locationId
      ? and(
          eq(userLocationRoles.role, "clinical"),
          eq(userLocationRoles.locationId, locationId),
          eq(users.orgId, session.orgId),
          isNull(users.deletedAt),
        )
      : and(
          eq(userLocationRoles.role, "clinical"),
          eq(users.orgId, session.orgId),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        );
    const [results, countResult] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          photoUrl: providerProfiles.photoUrl,
          specialization: providerProfiles.specialization,
          qualification: providerProfiles.qualification,
          education: providerProfiles.education,
          bio: providerProfiles.bio,
          yearsOfExperience: providerProfiles.yearsOfExperience,
          dateOfBirth: providerProfiles.dateOfBirth,
          bloodGroup: providerProfiles.bloodGroup,
          gender: providerProfiles.gender,
          address: providerProfiles.address,
        })
        .from(users)
        .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
        .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
        .where(whereClause)
        .orderBy(users.name)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(distinct ${users.id})::int` })
        .from(users)
        .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
        .where(whereClause),
    ]);
    const total = countResult[0]?.count ?? 0;

    const doctorIds = results.map((d) => d.id);
    const [patientCounts, doctorTreatmentsList] = await Promise.all([
      doctorIds.length
        ? db
            .select({
              providerId: appointments.providerId,
              patientCount: sql<number>`count(distinct ${appointments.patientId})::int`,
            })
            .from(appointments)
            .where(
              and(
                inArray(appointments.providerId, doctorIds),
                eq(appointments.status, "completed"),
              ),
            )
            .groupBy(appointments.providerId)
        : Promise.resolve([]),
      doctorIds.length
        ? db
            .select({
              doctorId: doctorTreatments.doctorId,
              treatmentId: treatments.id,
              treatmentName: treatments.name,
              category: treatments.category,
              durationMinutes: treatments.durationMinutes,
              priceCents: treatments.priceCents,
              locationId: treatments.locationId,
              locationName: locations.name,
            })
            .from(doctorTreatments)
            .innerJoin(treatments, eq(doctorTreatments.treatmentId, treatments.id))
            .leftJoin(locations, eq(treatments.locationId, locations.id))
            .where(inArray(doctorTreatments.doctorId, doctorIds))
        : Promise.resolve([]),
    ]);

    const countsByDoctor = new Map(
      patientCounts.map((p) => [p.providerId, p.patientCount]),
    );

    const treatmentsByDoctor = new Map<string, { id: string; name: string; category?: string; durationMinutes?: number; priceCents?: number; locationId?: string; locationName?: string }[]>();
    doctorTreatmentsList.forEach((dt) => {
      const list = treatmentsByDoctor.get(dt.doctorId) || [];
      list.push({
        id: dt.treatmentId,
        name: dt.treatmentName,
        category: dt.category || undefined,
        durationMinutes: dt.durationMinutes || undefined,
        priceCents: dt.priceCents || undefined,
        locationId: dt.locationId || undefined,
        locationName: dt.locationName || undefined,
      });
      treatmentsByDoctor.set(dt.doctorId, list);
    });

    const doctors = results.map((d) => {
      const docTreatments = treatmentsByDoctor.get(d.id) || [];
      return {
        ...d,
        photoUrl: imagePresets.thumbnail(d.photoUrl),
        patientsCheckedUp: countsByDoctor.get(d.id) ?? 0,
        treatments: docTreatments,
        treatmentIds: docTreatments.map((t) => t.id),
      };
    });

    return { success: true, doctors, pagination: { total, limit, offset } };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading doctors.",
      code: "SERVER_ERROR",
    };
  }
}
// ---------------------------------------- update doctor --------------------------------

export type UpdateDoctorResult =
  | {
      success: true;
      doctor: {
        id: string;
        name?: string;
        email?: string;
        photoUrl?: string | null;
      };
    }
  | { success: false; error: string; code: DoctorErrorCode };

export async function updateDoctor(doctorId: string, input: unknown): Promise<UpdateDoctorResult> {
  try {
    const session = await requireSession();
    await ensureDoctorTreatmentsTable();

    const parsed = updateDoctorSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const data = parsed.data;

    // Confirms this doctor genuinely belongs to the caller's own clinic
    // before touching anything - same ownership check used everywhere.
    const owned = await findOwnedDoctor(doctorId, session.orgId);
    if (!owned) {
      return { success: false, error: "Doctor not found.", code: "NOT_FOUND" };
    }

    const updatedUser = await db.transaction(async (tx) => {
      const userUpdates: Partial<{ name: string; email: string; phone: string | null; photoUrl: string | null }> = {};
      if (data.name !== undefined) userUpdates.name = data.name;
      if (data.email !== undefined && data.email !== owned.email) userUpdates.email = data.email;
      if (data.phone !== undefined) {
        const cleanPhone = data.phone?.trim() ? data.phone.trim() : null;
        if (cleanPhone !== owned.phone) userUpdates.phone = cleanPhone;
      }
      if (data.photoKey !== undefined) userUpdates.photoUrl = data.photoKey;

      let user = owned;
      if (Object.keys(userUpdates).length > 0) {
        const [updated] = await tx.update(users).set(userUpdates).where(eq(users.id, doctorId)).returning();
        user = updated;
      } else {
        const [existing] = await tx.select().from(users).where(eq(users.id, doctorId));
        user = existing;
      }

      const profileUpdates: Record<string, unknown> = { updatedAt: new Date() };
      if (data.photoKey !== undefined) profileUpdates.photoUrl = data.photoKey;
      if (data.specialization !== undefined) profileUpdates.specialization = data.specialization;
      if (data.qualification !== undefined) profileUpdates.qualification = data.qualification;
      if (data.education !== undefined) profileUpdates.education = data.education;
      if (data.bio !== undefined) profileUpdates.bio = data.bio;
      if (data.yearsOfExperience !== undefined) profileUpdates.yearsOfExperience = data.yearsOfExperience;
      if (data.dateOfBirth !== undefined) profileUpdates.dateOfBirth = data.dateOfBirth ? data.dateOfBirth : null;
      if (data.bloodGroup !== undefined) profileUpdates.bloodGroup = data.bloodGroup;
      if (data.gender !== undefined) profileUpdates.gender = data.gender;
      if (data.address !== undefined) profileUpdates.address = data.address;
      if (data.employmentType !== undefined) profileUpdates.employmentType = data.employmentType;

      const [existingProfile] = await tx.select().from(providerProfiles).where(eq(providerProfiles.userId, doctorId));
      if (existingProfile) {
        await tx.update(providerProfiles).set(profileUpdates).where(eq(providerProfiles.userId, doctorId));
      } else {
        await tx.insert(providerProfiles).values({
          userId: doctorId,
          ...profileUpdates,
        });
      }

      if (data.treatmentIds !== undefined) {
        await tx
          .delete(doctorTreatments)
          .where(eq(doctorTreatments.doctorId, doctorId));
        if (data.treatmentIds.length > 0) {
          await tx.insert(doctorTreatments).values(
            data.treatmentIds.map((treatmentId) => ({
              doctorId,
              treatmentId,
            })),
          );
        }
      }

      return user;
    });

    // Read AFTER the transaction commits, so this reflects the photo
    // that was just saved, not stale data from before the update ran.
    const [profile] = await db
      .select({ photoUrl: providerProfiles.photoUrl })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, doctorId));

    return {
      success: true,
      doctor: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        photoUrl: imagePresets.thumbnail(profile?.photoUrl ?? null),
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      const constraint =
        (err as { cause?: { constraint?: string } })?.cause?.constraint ?? "";
      if (constraint.includes("phone")) {
        return {
          success: false,
          error: "A staff member with this phone number already exists.",
          code: "DUPLICATE",
        };
      }
      return {
        success: false,
        error: "A staff member with this email already exists.",
        code: "DUPLICATE",
      };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating the doctor.", code: "SERVER_ERROR" };
  }
}
// -------------------------------- delete doctor -----------------------------------------------------------
export type DeleteDoctorResult =
  | { success: true }
  | { success: false; error: string; code: DoctorErrorCode };

export async function deleteDoctor(
  doctorId: string,
): Promise<DeleteDoctorResult> {
  try {
    const session = await requireSession();

    const owned = await findOwnedDoctor(doctorId, session.orgId);
    if (!owned) {
      return { success: false, error: "Doctor not found.", code: "NOT_FOUND" };
    }
    // Soft delete - every appointment and clinical note this doctor ever
    // created stays intact and correctly attributed. Nothing is actually
    // removed from the database.
    await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, doctorId));

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,

      error: "Something went wrong deleting the doctor.",
      code: "SERVER_ERROR",
    };
  }
}

// -------------------------------------doctor appoment history ----------------------------------------------
export type HistoryErrorCode = "UNAUTHORIZED" | "NOT_FOUND" | "SERVER_ERROR";

export type DoctorAppointmentHistoryResult =
  | {
      success: true;
      appointments: {
        id: string;
        startTime: Date;
        endTime: Date;
        status: string;
        treatmentName: string; // was serviceName
        patientId: string;
        patientName: string;
      }[];
      pagination: { total: number; limit: number; offset: number };
    }
  | { success: false; error: string; code: HistoryErrorCode };

export async function getAppointmentHistoryByDoctor(
  doctorId: string,
  options?: { limit?: number; offset?: number; from?: Date; to?: Date },
): Promise<DoctorAppointmentHistoryResult> {
  try {
    const session = await requireSession();

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(options?.offset ?? 0, 0);
    const doctor = await db.query.users.findFirst({
      where: and(eq(users.id, doctorId), eq(users.orgId, session.orgId)),
    });
    if (!doctor) {
      return { success: false, error: "Doctor not found.", code: "NOT_FOUND" };
    }

    // Optional date range - lets a caller ask for "this doctor's appointments
    // this week" instead of always pulling their entire history.
    const conditions = [
      eq(appointments.providerId, doctorId),
      ne(appointments.status, "requested"),
    ];
    if (options?.from)
      conditions.push(gte(appointments.startTime, options.from));
    if (options?.to) conditions.push(lte(appointments.startTime, options.to));
    const whereClause = and(...conditions);
    const [results, countResult] = await Promise.all([
      db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          treatmentName: treatments.name, // was serviceName: appointmentTypes.name
          patientId: patients.id,
          patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(treatments, eq(appointments.treatmentId, treatments.id)) // was appointmentTypes / appointmentTypeId
        .where(whereClause)
        .orderBy(desc(appointments.startTime))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
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
      error: "Something went wrong loading the doctor's appointments.",
      code: "SERVER_ERROR",
    };
  }
}

// ------------------------- get Patent History ------------------------------------
export type PatientHistoryByDoctorResult =
  | {
      success: true;
      visits: {
        appointmentId: string;
        startTime: Date;
        status: string;
        treatmentName: string; // was serviceName
        patientId: string;
        patientName: string;
      }[];
      pagination: { total: number; limit: number; offset: number };
    }
  | { success: false; error: string; code: HistoryErrorCode };
export async function getPatientHistoryByDoctor(
  doctorId: string,
  options?: { limit?: number; offset?: number },
): Promise<PatientHistoryByDoctorResult> {
  try {
    const session = await requireSession();

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(options?.offset ?? 0, 0);

    // Same ownership check - confirms the doctor belongs to this org before
    // revealing any of their patient history.
    const doctor = await db.query.users.findFirst({
      where: and(eq(users.id, doctorId), eq(users.orgId, session.orgId)),
    });
    if (!doctor) {
      return { success: false, error: "Doctor not found.", code: "NOT_FOUND" };
    }

    const whereClause = eq(appointments.providerId, doctorId);
    const [results, countResult] = await Promise.all([
      db
        .select({
          appointmentId: appointments.id,
          startTime: appointments.startTime,
          status: appointments.status,
          treatmentName: treatments.name, // was serviceName: appointmentTypes.name
          patientId: patients.id,
          patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(treatments, eq(appointments.treatmentId, treatments.id)) // was appointmentTypes / appointmentTypeId
        .where(whereClause)
        .orderBy(desc(appointments.startTime))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return {
      success: true,
      visits: results,
      pagination: { total, limit, offset },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading doctor's patient history.",
      code: "SERVER_ERROR",
    };
  }
}

// --------------------------------getSingle doctor --------------------------------------
export type GetDoctorResult =
  | {
      success: true;
      doctor: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        photoUrl: string | null;
        specialization: string | null;
        qualification: string | null;
        education: string | null;
        bio: string | null;
        yearsOfExperience: number | null;
        dateOfBirth: string | null;
        bloodGroup: string | null;
        gender: string | null;
        address: string | null;
        schedule: {
          dayOfWeek: number;
          // Nullable now - a day marked isOnLeave has no real hours stored.
          startTime: string | null;
          endTime: string | null;
          breakStartTime: string | null;
          breakEndTime: string | null;
          isOnLeave: boolean;
          locationId: string;
        }[];
        treatments?: {
          id: string;
          name: string;
          category: string;
          durationMinutes: number;
          priceCents: number;
        }[];
        treatmentIds?: string[];
      };
    }
  | { success: false; error: string; code: DoctorErrorCode };

export async function getDoctor(doctorId: string): Promise<GetDoctorResult> {
  try {
    const session = await requireSession();
    await ensureDoctorTreatmentsTable();

    const [record, schedule, doctorTreatmentRows] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          photoUrl: providerProfiles.photoUrl,
          specialization: providerProfiles.specialization,
          qualification: providerProfiles.qualification,
          education: providerProfiles.education,
          bio: providerProfiles.bio,
          yearsOfExperience: providerProfiles.yearsOfExperience,
          dateOfBirth: providerProfiles.dateOfBirth,
          bloodGroup: providerProfiles.bloodGroup,
          gender: providerProfiles.gender,
          address: providerProfiles.address,
        })
        .from(users)
        .leftJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
        .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
        .where(
          and(
            eq(users.id, doctorId),
            eq(users.orgId, session.orgId),
            eq(users.isActive, true),
            isNull(users.deletedAt),
          ),
        )
        .limit(1),
      db
        .select({
          dayOfWeek: providerSchedules.dayOfWeek,
          startTime: providerSchedules.startTime,
          endTime: providerSchedules.endTime,
          breakStartTime: providerSchedules.breakStartTime,
          breakEndTime: providerSchedules.breakEndTime,
          isOnLeave: providerSchedules.isOnLeave,
          bufferTime: providerSchedules.bufferTime,
          locationId: providerSchedules.locationId,
        })
        .from(providerSchedules)
        .where(eq(providerSchedules.userId, doctorId))
        .orderBy(providerSchedules.dayOfWeek, desc(providerSchedules.createdAt)),
      db
        .select({
          id: treatments.id,
          name: treatments.name,
          category: treatments.category,
          durationMinutes: treatments.durationMinutes,
          priceCents: treatments.priceCents,
          locationId: treatments.locationId,
          locationName: locations.name,
        })
        .from(doctorTreatments)
        .innerJoin(treatments, eq(doctorTreatments.treatmentId, treatments.id))
        .leftJoin(locations, eq(treatments.locationId, locations.id))
        .where(eq(doctorTreatments.doctorId, doctorId)),
    ]);

    const found = record[0];
    if (!found) {
      return { success: false, error: "Doctor not found.", code: "NOT_FOUND" };
    }

    const assignedTreatments = doctorTreatmentRows || [];
    const treatmentIds = assignedTreatments.map((t) => t.id);

    return {
      success: true,
      doctor: {
        ...found,
        photoUrl: imagePresets.full(found.photoUrl),
        schedule,
        treatments: assignedTreatments,
        treatmentIds,
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the doctor.",
      code: "SERVER_ERROR",
    };
  }
}

// -------------------------------- updateSchedule -----------------------------------------
export type UpdateScheduleResult =
  | { success: true }
  | { success: false; error: string; code: DoctorErrorCode };

// The actual logic - takes an explicit doctorId rather than reading it
// from the session itself, so both callers below can share one
// implementation without duplicating the replace-on-save transaction.
async function replaceSchedule(
  doctorId: string,
  data: UpdateScheduleInput,
): Promise<UpdateScheduleResult> {
  await db.transaction(async (tx) => {
    await tx
      .delete(providerSchedules)
      .where(
        and(
          eq(providerSchedules.userId, doctorId),
          eq(providerSchedules.locationId, data.locationId),
        ),
      );

    if (data.schedule.length > 0) {
      await tx.insert(providerSchedules).values(
        data.schedule.map((day) => ({
          userId: doctorId,
          locationId: data.locationId,
          dayOfWeek: day.dayOfWeek,
          isOnLeave: day.isOnLeave,
          startTime: day.isOnLeave ? null : day.startTime,
          endTime: day.isOnLeave ? null : day.endTime,
          breakStartTime: day.isOnLeave ? null : (day.breakStartTime || null),
          breakEndTime: day.isOnLeave ? null : (day.breakEndTime || null),
          bufferTime:
            typeof day.bufferTime === "number"
              ? day.bufferTime
              : typeof day.bufferMinutes === "number"
                ? day.bufferMinutes
                : 30,
        })),
      );
    }
  });

  return { success: true };
}

// Doctor editing their OWN hours - identity comes from session.userId
// only, never from the request. A doctor can never touch anyone else's
// schedule through this function, structurally, not just by convention.
export async function updateMySchedule(
  input: unknown,
): Promise<UpdateScheduleResult> {
  try {
    const session = await requireSession();

    const parsed = updateScheduleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;

    const assignment = await db.query.userLocationRoles.findFirst({
      where: and(
        eq(userLocationRoles.userId, session.userId),
        eq(userLocationRoles.locationId, data.locationId),
        eq(userLocationRoles.role, "clinical"),
      ),
    });
    if (!assignment) {
      return {
        success: false,
        error: "You are not assigned to this location.",
        code: "NOT_FOUND",
      };
    }

    return await replaceSchedule(session.userId, data);
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong updating your schedule.",
      code: "SERVER_ERROR",
    };
  }
}

// -------------------------- update by owner -----------------------------------
// comes from the URL, but ownership is still verified against session.orgId
// before anything is touched, same tenant-isolation pattern as everything
// else (findOwnedDoctor).
export async function updateDoctorSchedule(
  doctorId: string,
  input: unknown,
): Promise<UpdateScheduleResult> {
  try {
    const session = await requireSession();

    const parsed = updateScheduleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;

    const owned = await findOwnedDoctor(doctorId, session.orgId);
    if (!owned) {
      return { success: false, error: "Doctor not found.", code: "NOT_FOUND" };
    }

    const loc = await db.query.locations.findFirst({
      where: and(
        eq(locations.id, data.locationId),
        eq(locations.orgId, session.orgId),
      ),
    });
    if (!loc) {
      return {
        success: false,
        error: "Selected clinic location is invalid or does not belong to this organization.",
        code: "NOT_FOUND",
      };
    }

    return await replaceSchedule(doctorId, data);
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong updating the doctor's schedule.",
      code: "SERVER_ERROR",
    };
  }
}

// ------------------ get schedule information ----------------------------------

// Placeholder until breaks are a real, configurable column - hardcoded
// 1-hour lunch in the middle of the shift for now.
function computeBreakWindow(
  shiftStart: string,
  shiftEnd: string,
): { start: string; end: string } {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const toTimeStr = (mins: number) => {
    const h = Math.floor(mins / 60)
      .toString()
      .padStart(2, "0");
    const m = (mins % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  };
  const midpoint = Math.floor(
    (toMinutes(shiftStart) + toMinutes(shiftEnd)) / 2,
  );
  return { start: toTimeStr(midpoint - 30), end: toTimeStr(midpoint + 30) };
}

// added to src/lib/controllers/doctors.controller.ts
export type AllDoctorsScheduleResult =
  | {
      success: true;
      doctors: {
        id: string;
        name: string;
        specialization: string | null;
        status: "available" | "on_leave" | "not_scheduled";
        shiftStart: string | null;
        shiftEnd: string | null;
        openSlots: number;
        segments: {
          start: string;
          end: string;
          type: "free" | "booked" | "break";
        }[];
      }[];
    }
  | { success: false; error: string; code: DoctorErrorCode };

export async function getAllDoctorsScheduleTimeline(
  locationId?: string | null,
  date?: string | null,
): Promise<AllDoctorsScheduleResult> {
  try {
    const session = await requireSession();
    const activeDate = date || new Date().toISOString().slice(0, 10);
    const [y, m, d] = activeDate.split("-").map(Number);
    const dayOfWeek = new Date(y, (m || 1) - 1, d || 1).getDay();

    const whereClause = locationId
      ? and(
          eq(userLocationRoles.locationId, locationId),
          eq(userLocationRoles.role, "clinical"),
          eq(users.orgId, session.orgId),
          or(eq(users.isActive, true), isNull(users.isActive)),
          isNull(users.deletedAt),
        )
      : and(
          eq(userLocationRoles.role, "clinical"),
          eq(users.orgId, session.orgId),
          or(eq(users.isActive, true), isNull(users.isActive)),
          isNull(users.deletedAt),
        );

    // Fetch doctors
    let doctorsFound = await db
      .select({
        id: users.id,
        name: users.name,
        specialization: providerProfiles.specialization,
      })
      .from(users)
      .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
      .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
      .where(whereClause)
      .orderBy(users.name);

    if (doctorsFound.length === 0 && locationId) {
      doctorsFound = await db
        .select({
          id: users.id,
          name: users.name,
          specialization: providerProfiles.specialization,
        })
        .from(users)
        .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
        .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
        .where(
          and(
            eq(userLocationRoles.role, "clinical"),
            eq(users.orgId, session.orgId),
            or(eq(users.isActive, true), isNull(users.isActive)),
            isNull(users.deletedAt),
          )
        )
        .orderBy(users.name);
    }

    // Deduplicate doctors
    const uniqueDoctorsMap = new Map<string, (typeof doctorsFound)[0]>();
    for (const d of doctorsFound) {
      if (!uniqueDoctorsMap.has(d.id)) {
        uniqueDoctorsMap.set(d.id, d);
      }
    }
    const uniqueDoctors = Array.from(uniqueDoctorsMap.values());
    const doctorIds = uniqueDoctors.map((d) => d.id);

    if (doctorIds.length === 0) {
      return { success: true, doctors: [] };
    }

    // Fetch schedules for all doctors for today's dayOfWeek
    const schedules = await db
      .select({
        userId: providerSchedules.userId,
        locationId: providerSchedules.locationId,
        startTime: providerSchedules.startTime,
        endTime: providerSchedules.endTime,
        breakStartTime: providerSchedules.breakStartTime,
        breakEndTime: providerSchedules.breakEndTime,
        isOnLeave: providerSchedules.isOnLeave,
        bufferTime: providerSchedules.bufferTime,
      })
      .from(providerSchedules)
      .where(
        and(
          inArray(providerSchedules.userId, doctorIds),
          eq(providerSchedules.dayOfWeek, dayOfWeek),
        ),
      );

    const scheduleByDoc = new Map<string, (typeof schedules)[0]>();
    for (const s of schedules) {
      const existing = scheduleByDoc.get(s.userId);
      // Prioritize matching locationId if available
      if (!existing || (locationId && s.locationId === locationId)) {
        scheduleByDoc.set(s.userId, s);
      }
    }

    // Fetch bookings with ±24h buffer to prevent timezone boundary clipping
    const targetDate = new Date(`${activeDate}T12:00:00`);
    const dayStart = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000);
    const dayEnd = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
    const allBookings = await db
      .select({
        providerId: appointments.providerId,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
      })
      .from(appointments)
      .where(
        and(
          inArray(appointments.providerId, doctorIds),
          inArray(appointments.status, ["confirmed", "checked_in", "completed"]),
          gte(appointments.startTime, dayStart),
          lte(appointments.startTime, dayEnd),
        ),
      );

    const bookingsByDoctor = new Map<
      string,
      { startTime: Date; endTime: Date }[]
    >();
    for (const b of allBookings) {
      const bStart = b.startTime instanceof Date ? b.startTime : new Date(b.startTime);
      const bYear = bStart.getFullYear();
      const bMonth = String(bStart.getMonth() + 1).padStart(2, "0");
      const bDay = String(bStart.getDate()).padStart(2, "0");
      const bDateStr = `${bYear}-${bMonth}-${bDay}`;
      if (bDateStr === activeDate) {
        const list = bookingsByDoctor.get(b.providerId) ?? [];
        list.push({
          startTime: bStart,
          endTime: b.endTime instanceof Date ? b.endTime : new Date(b.endTime),
        });
        bookingsByDoctor.set(b.providerId, list);
      }
    }

    const toMins = (t: string) => {
      const parts = t.split(":");
      return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    };

    const toStr = (mins: number) => {
      const h = Math.floor(mins / 60).toString().padStart(2, "0");
      const m = (mins % 60).toString().padStart(2, "0");
      return `${h}:${m}:00`;
    };

    const doctors = uniqueDoctors.map((doc) => {
      const sched = scheduleByDoc.get(doc.id);

      if (sched?.isOnLeave) {
        return {
          id: doc.id,
          name: doc.name,
          specialization: doc.specialization,
          status: "on_leave" as const,
          shiftStart: null,
          shiftEnd: null,
          openSlots: 0,
          segments: [],
        };
      }

      // If doctor has explicit schedule, use it; otherwise use clinic default (09:00 - 17:00 on Mon-Fri, leave on Sun/Sat)
      let sTimeStr = "09:00";
      let eTimeStr = "17:00";
      let breakStart: string | null = null;
      let breakEnd: string | null = null;
      let bufferMinutes = 30;

      if (sched && sched.startTime && sched.endTime) {
        sTimeStr = sched.startTime.slice(0, 5);
        eTimeStr = sched.endTime.slice(0, 5);
        breakStart = sched.breakStartTime ? sched.breakStartTime.slice(0, 5) : null;
        breakEnd = sched.breakEndTime ? sched.breakEndTime.slice(0, 5) : null;
        bufferMinutes = typeof sched.bufferTime === "number" ? sched.bufferTime : 30;
      } else if (!sched) {
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          return {
            id: doc.id,
            name: doc.name,
            specialization: doc.specialization,
            status: "on_leave" as const,
            shiftStart: null,
            shiftEnd: null,
            openSlots: 0,
            segments: [],
          };
        }
      }

      const shiftStartMins = toMins(sTimeStr);
      const shiftEndMins = toMins(eTimeStr);

      if (shiftEndMins <= shiftStartMins) {
        return {
          id: doc.id,
          name: doc.name,
          specialization: doc.specialization,
          status: "available" as const,
          shiftStart: `${sTimeStr}:00`,
          shiftEnd: `${eTimeStr}:00`,
          openSlots: 0,
          segments: [],
        };
      }

      const docBufferMinutes = bufferMinutes;

      type Interval = { startMins: number; endMins: number; type: "booked" | "break" };
      const busyList: Interval[] = [];

      // Break window
      if (breakStart && breakEnd) {
        const bStart = toMins(breakStart);
        const bEnd = toMins(breakEnd);
        if (bEnd > bStart) {
          busyList.push({ startMins: bStart, endMins: bEnd, type: "break" });
        }
      }

      // Bookings
      const bookings = bookingsByDoctor.get(doc.id) ?? [];
      for (const b of bookings) {
        const bStartObj = b.startTime instanceof Date ? b.startTime : new Date(b.startTime);
        const bEndObj = b.endTime instanceof Date ? b.endTime : new Date(b.endTime);
        const bStart = bStartObj.getHours() * 60 + bStartObj.getMinutes();
        const bEnd =
          bEndObj.getHours() * 60 +
          bEndObj.getMinutes() +
          docBufferMinutes;
        if (bStart < shiftEndMins && bEnd > shiftStartMins) {
          busyList.push({
            startMins: Math.max(shiftStartMins, bStart),
            endMins: Math.min(shiftEndMins, bEnd),
            type: "booked",
          });
        }
      }

      busyList.sort((a, b) => a.startMins - b.startMins);

      const segments: {
        start: string;
        end: string;
        type: "free" | "booked" | "break";
      }[] = [];

      let cursor = shiftStartMins;

      for (const busy of busyList) {
        if (busy.startMins > cursor) {
          segments.push({
            start: toStr(cursor),
            end: toStr(busy.startMins),
            type: "free",
          });
          segments.push({
            start: toStr(busy.startMins),
            end: toStr(busy.endMins),
            type: busy.type,
          });
          cursor = busy.endMins;
        } else if (busy.endMins > cursor) {
          segments.push({
            start: toStr(cursor),
            end: toStr(busy.endMins),
            type: busy.type,
          });
          cursor = busy.endMins;
        }
      }

      if (cursor < shiftEndMins) {
        segments.push({
          start: toStr(cursor),
          end: toStr(shiftEndMins),
          type: "free",
        });
      }

      const freeMinutes = segments
        .filter((s) => s.type === "free")
        .reduce((sum, s) => sum + (toMins(s.end) - toMins(s.start)), 0);

      const openSlots = Math.floor(freeMinutes / 30);

      return {
        id: doc.id,
        name: doc.name,
        specialization: doc.specialization,
        status: "available" as const,
        shiftStart: `${sTimeStr}:00`,
        shiftEnd: `${eTimeStr}:00`,
        openSlots,
        segments,
      };
    });

    return { success: true, doctors };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading doctor schedules.",
      code: "SERVER_ERROR",
    };
  }
}

// ------------------------- get doctor name and id ---------------------------------------
export type GetDoctorNameAndIdResult =
  | {
      success: true;
      doctors: {
        id: string;
        name: string;
      }[];
    }
  | { success: false; error: string; code: DoctorErrorCode };

export async function getDoctorNameAndId(
  locationId?: string,
): Promise<GetDoctorNameAndIdResult> {
  try {
    const session = await requireSession();
    const whereClause = locationId
      ? and(
          eq(userLocationRoles.role, "clinical"),
          eq(userLocationRoles.locationId, locationId),
          eq(users.orgId, session.orgId),
          isNull(users.deletedAt),
        )
      : and(
          eq(userLocationRoles.role, "clinical"),
          eq(users.orgId, session.orgId),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        );
    const result = await db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
      .where(whereClause)
      .orderBy(users.name);
    return { success: true, doctors: result };
  } catch (error) {
    if (error instanceof SessionError) {
      return { success: false, error: error.message, code: "UNAUTHORIZED" };
    }
    console.error(error);
    return {
      success: false,
      error: "Something went wrong loading doctor names and ids.",
      code: "SERVER_ERROR",
    };
  }
}
