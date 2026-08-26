// src/lib/controllers/users.controller.ts
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { locations, providerProfiles, userLocationRoles, users } from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { updateMyDetailsSchema } from "@/lib/validators/users";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { refreshTokens } from "@/db/schema";
import { changePasswordSchema } from "@/lib/validators/users";
import { imagePresets } from "@/lib/cloudinary/storage";
import { updateDoctorSchema } from "@/lib/validators/doctor";
import { DoctorErrorCode } from "../doctor/controller";



export type UserErrorCode = "UNAUTHORIZED" | "VALIDATION" | "DUPLICATE" | "SERVER_ERROR";

function getPgErrorCode(err: unknown): string | undefined {
  return (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
}

export type UpdateMyDetailsResult =
  | { success: true; user: { id: string; name: string; email: string; phone: string | null ,photoUrl : string | null} }
  | { success: false; error: string; code: UserErrorCode };

// Self-scoped, same pattern as updateMySchedule - identity comes from
// session.userId only, never accepted from the request. A staff member
// can only ever edit their OWN name/email/phone through this function.
export async function updateMyDetails(input: unknown): Promise<UpdateMyDetailsResult> {
  try {
    const session = await requireSession();

    const parsed = updateMyDetailsSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const data = parsed.data;

    const current = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
    if (!current) {
      return { success: false, error: "Account not found.", code: "VALIDATION" };
    }

    const updates: Record<string, unknown> = {};
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const [currentFirst, ...currentRest] = current.name.split(" ");
      const firstName = data.firstName ?? currentFirst;
      const lastName = data.lastName ?? currentRest.join(" ");
      updates.name = [firstName, lastName].filter(Boolean).join(" ");
    }
    if (data.email !== undefined) updates.email = data.email;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.photoKey !== undefined) updates.photoUrl = data.photoKey;

    const [updated] = await db.update(users).set(updates).where(eq(users.id, session.userId)).returning();

    return {
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        photoUrl: imagePresets.thumbnail(updated.photoUrl),
    },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return { success: false, error: "This email or phone number is already in use.", code: "DUPLICATE" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating your details.", code: "SERVER_ERROR" };
  }
}



export type ChangePasswordResult = { success: true } | { success: false; error: string; code: UserErrorCode };

export async function changeMyPassword(input: unknown): Promise<ChangePasswordResult> {
  try {
    const session = await requireSession();

    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const data = parsed.data;

    const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
    if (!user) {
      return { success: false, error: "Account not found.", code: "VALIDATION" };
    }

    // The real check - proves they actually know the CURRENT password,
    // not just that they have a valid session. Being logged in isn't
    // enough on its own to authorize a password change.
    const isValid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, error: "Current password is incorrect.", code: "VALIDATION" };
    }

    // A new password should be genuinely different, not just re-typed -
    // otherwise "change password" silently does nothing.
    const isSamePassword = await verifyPassword(data.newPassword, user.passwordHash);
    if (isSamePassword) {
      return { success: false, error: "New password must be different from your current password.", code: "VALIDATION" };
    }

    const newPasswordHash = await hashPassword(data.newPassword);

    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, session.userId));
      // Same reasoning as the forgot-password reset flow - a password
      // change should kill every existing session, not just this one,
      // in case the account was compromised.
      await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, session.userId));
    });

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong changing your password.", code: "SERVER_ERROR" };
  }
}

export type GetMyDetailsResult =
  | {
      success: true;
      user: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        photoUrl: string | null;
        isOwner?: boolean;
        role?: string | null;
        locationId?: string | null;
        locations?: { locationId: string; role: string; locationName: string | null }[];
      };
    }
  | { success: false; error: string; code: UserErrorCode };

export async function getMyDetails(): Promise<GetMyDetailsResult> {
  try {
    const session = await requireSession();

    const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
    if (!user) {
      return { success: false, error: "Account not found.", code: "VALIDATION" };
    }

    const locationRoles = await db
      .select({
        locationId: userLocationRoles.locationId,
        role: userLocationRoles.role,
        locationName: locations.name,
      })
      .from(userLocationRoles)
      .leftJoin(locations, eq(locations.id, userLocationRoles.locationId))
      .where(eq(userLocationRoles.userId, session.userId));

    const primaryLocationId = locationRoles[0]?.locationId ?? null;
    const primaryRole = user.isOwner ? "owner" : (locationRoles[0]?.role ?? null);

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photoUrl: imagePresets.thumbnail(user.photoUrl),
        isOwner: user.isOwner,
        role: primaryRole,
        locationId: primaryLocationId,
        locations: locationRoles,
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading your details.", code: "SERVER_ERROR" };
  }
}
async function findOwnedDoctor(doctorId: string, orgId: string) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
    .where(
      and(
        eq(users.id, doctorId),
        eq(users.orgId, orgId),
        eq(userLocationRoles.role, "clinical")
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

// export type UpdateDoctorResult =
//   | {
//       success: true;
//       doctor: { id: string; };
//     }
//   | { success: false; error: string; code: DoctorErrorCode };

// export async function updateDoctor(doctorId: string, input: unknown): Promise<UpdateDoctorResult> {
//   try {
//     const session = await requireSession();

//     const parsed = updateDoctorSchema.safeParse(input);
//     if (!parsed.success) {
//       return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
//     }
//     const data = parsed.data;

//     // Confirms this doctor genuinely belongs to the caller's own clinic
//     // before touching anything - same ownership check used everywhere.
//     const owned = await findOwnedDoctor(doctorId, session.orgId);
//     if (!owned) {
//       return { success: false, error: "Doctor not found.", code: "NOT_FOUND" };
//     }

//     const updatedUser = await db.transaction(async (tx) => {
//       const userUpdates: Partial<{ name: string; email: string; phone: string }> = {};
//       if (data.name !== undefined) userUpdates.name = data.name;
//       if (data.email !== undefined) userUpdates.email = data.email;
//       if (data.phone !== undefined) userUpdates.phone = data.phone;

//       let user = owned;
//       if (Object.keys(userUpdates).length > 0) {
//         const [updated] = await tx.update(users).set(userUpdates).where(eq(users.id, doctorId)).returning();
//         user = updated;
//       } else {
//         const [existing] = await tx.select().from(users).where(eq(users.id, doctorId));
//         user = existing;
//       }

//       const profileUpdates: Record<string, unknown> = { updatedAt: new Date() };
//       if (data.photoKey !== undefined) profileUpdates.photoUrl = data.photoKey;
//       if (data.specialization !== undefined) profileUpdates.specialization = data.specialization;
//       if (data.qualification !== undefined) profileUpdates.qualification = data.qualification;
//       if (data.education !== undefined) profileUpdates.education = data.education;
//       if (data.bio !== undefined) profileUpdates.bio = data.bio;
//       if (data.yearsOfExperience !== undefined) profileUpdates.yearsOfExperience = data.yearsOfExperience;
//       if (data.dateOfBirth !== undefined) profileUpdates.dateOfBirth = data.dateOfBirth;
//       if (data.bloodGroup !== undefined) profileUpdates.bloodGroup = data.bloodGroup;
//       if (data.gender !== undefined) profileUpdates.gender = data.gender;
//       if (data.address !== undefined) profileUpdates.address = data.address;
//       if (data.employmentType !== undefined) profileUpdates.employmentType = data.employmentType;

//       await tx.update(providerProfiles).set(profileUpdates).where(eq(providerProfiles.userId, doctorId));

//       return user;
//     });

//     // Read AFTER the transaction commits, so this reflects the photo
//     // that was just saved, not stale data from before the update ran.
//     const [profile] = await db
//       .select({ photoUrl: providerProfiles.photoUrl })
//       .from(providerProfiles)
//       .where(eq(providerProfiles.userId, doctorId));

//     return {
//       success: true,
//       doctor: {
//         id: updatedUser.id,
//       },
//     };
//   } catch (err) {
//     if (err instanceof SessionError) {
//       return { success: false, error: err.message, code: "UNAUTHORIZED" };
//     }
//     if (getPgErrorCode(err) === "23505") {
//       return { success: false, error: "A staff member with this email already exists.", code: "DUPLICATE" };
//     }
//     console.error(err);
//     return { success: false, error: "Something went wrong updating the doctor.", code: "SERVER_ERROR" };
//   }
// }





