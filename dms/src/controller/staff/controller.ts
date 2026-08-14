import { eq, and, sql, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, userLocationRoles, locations, organizations } from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { hashPassword } from "@/lib/auth/hash";
import { createStaffSchema, updateStaffSchema } from "@/lib/validators/staff";
import { sendStaffWelcomeEmail } from "@/lib/email/sendWelComeMail";
import { imagePresets } from "@/lib/cloudinary/storage";

export type StaffErrorCode = "UNAUTHORIZED" | "VALIDATION" | "NOT_FOUND" | "DUPLICATE" | "SERVER_ERROR";

function getPgErrorCode(err: unknown): string | undefined {
  return (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
}

async function findOwnedStaff(staffId: string, orgId: string) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, staffId), eq(users.orgId, orgId), isNull(users.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export type CreateStaffResult =
  | {
      success: true;
      staff: { id: string; name: string; email: string; role: string; photoUrl: string | null };
      emailSent: boolean;
    }
  | { success: false; error: string; code: StaffErrorCode };

export async function createStaff(input: unknown): Promise<CreateStaffResult> {
  try {
    const session = await requireSession();

    const parsed = createStaffSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const data = parsed.data;

    const [location, org] = await Promise.all([
      db.query.locations.findFirst({
        where: and(eq(locations.id, data.locationId), eq(locations.orgId, session.orgId)),
      }),
      db.query.organizations.findFirst({ where: eq(organizations.id, session.orgId) }),
    ]);

    if (!location) {
      return { success: false, error: "Location not found.", code: "NOT_FOUND" };
    }
    if (!org) {
      return { success: false, error: "Organization not found.", code: "NOT_FOUND" };
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
          photoUrl: data.photoKey,
          shift: data.shift,
          joinDate: data.joinDate,
          gender: data.gender,
          address: data.address,
          // notes: data.notes,
          isActive: data.isActive ?? true,
        })
        .returning();

      await tx.insert(userLocationRoles).values({
        userId: user.id,
        locationId: data.locationId,
        role: data.role,
      });

      return user;
    });

    // Same "don't fail the whole creation over a flaky email" reasoning
    // as createDoctor - the account is already real and usable either way.
    let emailSent = true;
    try {
      const roleLabel = data.role === "front_office" ? "Front Desk" : data.role === "manager" ? "Manager" : "Clinical";
      await sendStaffWelcomeEmail(data.email, data.name, data.password, org.name, roleLabel);
    } catch (emailErr) {
      console.error("Staff created, but welcome email failed to send:", emailErr);
      emailSent = false;
    }

    return {
      success: true,
      staff: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: data.role,
        photoUrl: imagePresets.thumbnail(data.photoKey ?? null),
      },
      emailSent,
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return { success: false, error: "A staff member with this email already exists.", code: "DUPLICATE" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong creating the staff member.", code: "SERVER_ERROR" };
  }
}


// -------------------------------- get staff ------------------------------------------
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export type GetStaffListResult =
  | {
      success: true;
      staff: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        role: string;
        locationId: string;
        photoUrl: string | null;
        shift: string | null;
        isActive: boolean;
      }[];
      pagination: { total: number; limit: number; offset: number };
    }
  | { success: false; error: string; code: StaffErrorCode };


  export async function getStaffList(
  locationId?: string,
  options?: { limit?: number; offset?: number }
): Promise<GetStaffListResult> {
  try {
    const session = await requireSession();

    const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(options?.offset ?? 0, 0);

    const whereClause = locationId
      ? and(
          eq(userLocationRoles.locationId, locationId),
          eq(users.orgId, session.orgId),
          isNull(users.deletedAt)
        )
      : and(eq(users.orgId, session.orgId), isNull(users.deletedAt));

    const [results, countResult] = await Promise.all([
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: userLocationRoles.role,
          locationId: userLocationRoles.locationId,
          photoUrl: users.photoUrl,
          address : users.address,
          createdAt : users.createdAt,
          shift: users.shift,
          isActive: users.isActive,
        })
        .from(users)
        .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
        .where(whereClause)
        .orderBy(users.name)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      success: true,
      staff: results.map((s) => ({ ...s, photoUrl: imagePresets.thumbnail(s.photoUrl) })),
      pagination: { total, limit, offset },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading staff.", code: "SERVER_ERROR" };
  }
}

// --------------------------------- update -------------------------------------------
export type UpdateStaffResult =
  | { success: true; staff: { id: string;} }
  | { success: false; error: string; code: StaffErrorCode };

 export async function updateStaff(staffId: string, input: unknown): Promise<UpdateStaffResult> {
  try {
    const session = await requireSession();

    const parsed = updateStaffSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const data = parsed.data;

    const userUpdates: Record<string, unknown> = {};
    if (data.name !== undefined) userUpdates.name = data.name;
    if (data.email !== undefined) userUpdates.email = data.email;
    if (data.phone !== undefined) userUpdates.phone = data.phone;
    if (data.photoKey !== undefined) userUpdates.photoUrl = data.photoKey;
    if (data.shift !== undefined) userUpdates.shift = data.shift;
    if (data.joinDate !== undefined) userUpdates.joinDate = data.joinDate;
    if (data.gender !== undefined) userUpdates.gender = data.gender;
    if (data.address !== undefined) userUpdates.address = data.address;
    if (data.notes !== undefined) userUpdates.notes = data.notes;
    if (data.isActive !== undefined) userUpdates.isActive = data.isActive;

    const updatedUser = await db.transaction(async (tx) => {
      // The ownership check and the actual update are now the SAME
      // query - if the WHERE clause doesn't match (wrong org, doesn't
      // exist), .returning() comes back empty and that's our NOT_FOUND
      // signal. No separate findOwnedStaff lookup beforehand, no second
      // SELECT afterward when there's nothing new to write.
      const [updated] = await tx
        .update(users)
        .set(Object.keys(userUpdates).length > 0 ? userUpdates : { updatedAt: sql`now()` })
        .where(and(eq(users.id, staffId), eq(users.orgId, session.orgId)))
        .returning();

      if (!updated) return null;

      if (data.role !== undefined) {
        await tx.update(userLocationRoles).set({ role: data.role }).where(eq(userLocationRoles.userId, staffId));
      }

      return updated;
    });

    if (!updatedUser) {
      return { success: false, error: "Staff member not found.", code: "NOT_FOUND" };
    }

    return {
      success: true,
      staff: {
        id: updatedUser.id,
 
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
    return { success: false, error: "Something went wrong updating the staff member.", code: "SERVER_ERROR" };
  }
}

// ---------------------delete ----------------------------------------
export type DeleteStaffResult = { success: true } | { success: false; error: string; code: StaffErrorCode };

// Soft delete, same reasoning as doctors and patients - a staff member
// with any real history (appointments they created, notes they wrote)
// should never be silently erased. deletedAt hides them everywhere active
// without touching anything they've ever created.
export async function deleteStaff(staffId: string): Promise<DeleteStaffResult> {
  try {
    const session = await requireSession();

    const owned = await findOwnedStaff(staffId, session.orgId);
    if (!owned) {
      return { success: false, error: "Staff member not found.", code: "NOT_FOUND" };
    }

    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, staffId));

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong removing the staff member.", code: "SERVER_ERROR" };
  }
}

// ----------------- get One ---------------------------

export type GetStaffResult =
  | {
      success: true;
      staff: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        role: string;
        locationId: string;
        photoUrl: string | null;
        shift: string | null;
        joinDate: string | null;
        gender: string | null;
        address: string | null;
        // notes: string | null;
        isActive: boolean;
      };
    }
  | { success: false; error: string; code: StaffErrorCode };

export async function getStaffById(staffId: string): Promise<GetStaffResult> {
  try {
    const session = await requireSession();

    const [result] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: userLocationRoles.role,
        locationId: userLocationRoles.locationId,
        photoUrl: users.photoUrl,
        shift: users.shift,
        joinDate: users.joinDate,
        gender: users.gender,
        address: users.address,
        // notes: users.notes,
        isActive: users.isActive,
      })
      .from(users)
      .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
      .where(and(eq(users.id, staffId), eq(users.orgId, session.orgId), isNull(users.deletedAt)))
      .limit(1);

    if (!result) {
      return { success: false, error: "Staff member not found.", code: "NOT_FOUND" };
    }

    return { success: true, staff: { ...result, photoUrl: imagePresets.full(result.photoUrl) } };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the staff member.", code: "SERVER_ERROR" };
  }
}