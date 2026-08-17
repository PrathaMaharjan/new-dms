import { db } from "@/db";
import {
  appointments,
  appointmentTypes,
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
  sql,
} from "drizzle-orm";

export type DoctorErrorCode =
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

// Confirms a user is both (a) a real clinical staff member and (b) belongs
// to the caller's own org - the same two-part check used for Treatments.
async function findOwnedDoctor(doctorId: string, orgId: string) {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
    .where(
      and(
        eq(users.id, doctorId),
        eq(users.orgId, orgId),
        eq(userLocationRoles.role, "clinical"),
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
    const patientCounts = doctorIds.length
      ? await db
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
      : [];
    const countsByDoctor = new Map(
      patientCounts.map((p) => [p.providerId, p.patientCount]),
    );

    const doctors = results.map((d) => ({
      ...d,
      photoUrl: imagePresets.thumbnail(d.photoUrl),
      patientsCheckedUp: countsByDoctor.get(d.id) ?? 0,
    }));

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
      const userUpdates: Partial<{ name: string; email: string; phone: string }> = {};
      if (data.name !== undefined) userUpdates.name = data.name;
      if (data.email !== undefined) userUpdates.email = data.email;
      if (data.phone !== undefined) userUpdates.phone = data.phone;

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

      await tx.update(providerProfiles).set(profileUpdates).where(eq(providerProfiles.userId, doctorId));

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
      return { success: false, error: "A staff member with this email already exists.", code: "DUPLICATE" };
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
    const conditions = [eq(appointments.providerId, doctorId)];
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
          isOnLeave: boolean;
          locationId: string;
        }[];
      };
    }
  | { success: false; error: string; code: DoctorErrorCode };

export async function getDoctor(doctorId: string): Promise<GetDoctorResult> {
  try {
    const session = await requireSession();

    const [record, schedule] = await Promise.all([
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
        .where(
          and(
            eq(users.id, doctorId),
            eq(users.orgId, session.orgId),
            eq(userLocationRoles.role, "clinical"),
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
          isOnLeave: providerSchedules.isOnLeave,
          locationId: providerSchedules.locationId,
        })
        .from(providerSchedules)
        .where(eq(providerSchedules.userId, doctorId))
        .orderBy(providerSchedules.dayOfWeek),
    ]);

    const found = record[0];
    if (!found) {
      return { success: false, error: "Doctor not found.", code: "NOT_FOUND" };
    }

    return {
      success: true,
      doctor: {
        ...found,
        photoUrl: imagePresets.full(found.photoUrl),
        schedule,
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
  locationId: string,
  date: string,
): Promise<AllDoctorsScheduleResult> {
  try {
    const session = await requireSession();
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay();

    // Every active clinical doctor at this location - the front desk view
    // shown regardless of whether they're scheduled today at all.
    const doctorRows = await db
      .select({
        id: users.id,
        name: users.name,
        specialization: providerProfiles.specialization,
        startTime: providerSchedules.startTime,
        endTime: providerSchedules.endTime,
        isOnLeave: providerSchedules.isOnLeave,
      })
      .from(users)
      .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
      .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
      .leftJoin(
        providerSchedules,
        and(
          eq(providerSchedules.userId, users.id),
          eq(providerSchedules.locationId, locationId),
          eq(providerSchedules.dayOfWeek, dayOfWeek),
        ),
      )
      .where(
        and(
          eq(userLocationRoles.locationId, locationId),
          eq(userLocationRoles.role, "clinical"),
          eq(users.orgId, session.orgId),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(users.name);

    const doctorIds = doctorRows.map((d) => d.id);

    // ONE query for every doctor's bookings, not one query per doctor -
    // same "avoid N+1" reasoning as everywhere else in this project.
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    const allBookings = doctorIds.length
      ? await db
          .select({
            providerId: appointments.providerId,
            startTime: appointments.startTime,
            endTime: appointments.endTime,
          })
          .from(appointments)
          .where(
            and(
              inArray(appointments.providerId, doctorIds),
              ne(appointments.status, "cancelled"),
              gt(appointments.startTime, dayStart),
              lt(appointments.startTime, dayEnd),
            ),
          )
      : [];

    const bookingsByDoctor = new Map<
      string,
      { startTime: Date; endTime: Date }[]
    >();
    for (const b of allBookings) {
      const list = bookingsByDoctor.get(b.providerId) ?? [];
      list.push({ startTime: b.startTime, endTime: b.endTime });
      bookingsByDoctor.set(b.providerId, list);
    }

    const doctors = doctorRows.map((doctorRow) => {
      if (!doctorRow.startTime || !doctorRow.endTime || doctorRow.isOnLeave) {
        return {
          id: doctorRow.id,
          name: doctorRow.name,
          specialization: doctorRow.specialization,
          status: doctorRow.isOnLeave
            ? ("on_leave" as const)
            : ("not_scheduled" as const),
          shiftStart: null,
          shiftEnd: null,
          openSlots: 0,
          segments: [],
        };
      }

      const bookings = bookingsByDoctor.get(doctorRow.id) ?? [];
      const breakWindow = computeBreakWindow(
        doctorRow.startTime,
        doctorRow.endTime,
      );

      type Interval = { start: string; end: string; type: "booked" | "break" };
      const busy: Interval[] = [
        ...bookings.map((a) => {
          const bufferedEnd = new Date(a.endTime.getTime() + 30 * 60_000);
          return {
            start: a.startTime.toTimeString().slice(0, 5),
            end: bufferedEnd.toTimeString().slice(0, 5),
            type: "booked" as const,
          };
        }),
        { ...breakWindow, type: "break" as const },
      ].sort((a, b) => a.start.localeCompare(b.start));

      const segments: {
        start: string;
        end: string;
        type: "free" | "booked" | "break";
      }[] = [];
      let cursor = doctorRow.startTime;

      for (const interval of busy) {
        if (interval.start > cursor) {
          segments.push({ start: cursor, end: interval.start, type: "free" });
        }
        segments.push(interval);
        cursor = interval.end > cursor ? interval.end : cursor;
      }
      if (cursor < doctorRow.endTime) {
        segments.push({ start: cursor, end: doctorRow.endTime, type: "free" });
      }

      const freeMinutes = segments
        .filter((s) => s.type === "free")
        .reduce((sum, s) => {
          const [sh, sm] = s.start.split(":").map(Number);
          const [eh, em] = s.end.split(":").map(Number);
          return sum + (eh * 60 + em - (sh * 60 + sm));
        }, 0);
      const openSlots = Math.floor(freeMinutes / 30);

      return {
        id: doctorRow.id,
        name: doctorRow.name,
        specialization: doctorRow.specialization,
        status:
          openSlots === 0 ? ("on_leave" as const) : ("available" as const),
        shiftStart: doctorRow.startTime,
        shiftEnd: doctorRow.endTime,
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
