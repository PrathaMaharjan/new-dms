import { db } from "@/db";
import { locations, userLocationRoles, users } from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import {
  createLocationSchema,
  updateLocationSchema,
} from "@/lib/validators/outlets";
import { and, eq } from "drizzle-orm";

export type LocationErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
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

async function requireOwner(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

  return user?.isOwner === true;
}

export type CreateLocationResult =
  | { success: true; location: typeof locations.$inferSelect }
  | { success: false; error: string; code: LocationErrorCode };

// Only the org-wide owner can open a new outlet - a manager runs one
// location day-to-day, but deciding to open a second one is a structural,
// org-level decision, same reasoning we settled on earlier.
export async function createLocation(
  input: unknown,
): Promise<CreateLocationResult> {
  try {
    const session = await requireSession();

    if (!(await requireOwner(session.userId))) {
      return {
        success: false,
        error: "Only the organization owner can create a new outlet.",
        code: "FORBIDDEN",
      };
    }

    const parsed = createLocationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;
    const [location] = await db
      .insert(locations)
      .values({
        orgId: session.orgId,
        name: data.name,
        address: data.address,
        city: data.city,
        phone: data.phone,
        email: data.email,
        timezone: data.timezone,
        openingTime: data.openingTime,
        closingTime: data.closingTime,
        // notes: data.notes,
        isActive: data.isActive,
      })
      .returning();

    return { success: true, location };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return {
        success: false,
        error: "An outlet with this name already exists.",
        code: "DUPLICATE",
      };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong creating the outlet.",
      code: "SERVER_ERROR",
    };
  }
}

// -------------------get All Outlets ---------------------------------
export type LocationWithManager = typeof locations.$inferSelect & { managerName: string | null };

export type GetLocationsResult =
  | { success: true; locations: Awaited<ReturnType<typeof getLocationsQuery>> }
  | { success: false; error: string; code: LocationErrorCode };

async function getLocationsQuery(orgId: string) {
  return db
    .select({
      id: locations.id,
      orgId: locations.orgId,
      name: locations.name,
      address: locations.address,
      city: locations.city,
      phone: locations.phone,
      email: locations.email,
      timezone: locations.timezone,
      openingTime: locations.openingTime,
      closingTime: locations.closingTime,
      notes: locations.notes,
      isActive: locations.isActive,
      managerName: users.name,
    })
    .from(locations)
    .leftJoin(userLocationRoles, and(eq(userLocationRoles.locationId, locations.id), eq(userLocationRoles.role, "manager")))
    .leftJoin(users, eq(users.id, userLocationRoles.userId))
    .where(eq(locations.orgId, orgId))
    .orderBy(locations.name);
}

export async function getLocations(): Promise<GetLocationsResult> {
  try {
    const session = await requireSession();
    const results = await getLocationsQuery(session.orgId);
    return { success: true, locations: results };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading outlets.", code: "SERVER_ERROR" };
  }
}

// -------------------- delete outlets --------------------------

export type DeleteLocationResult =
  | { success: true }
  | { success: false; error: string; code: LocationErrorCode };

// Soft-close, not a hard delete - locations cascade to patients,
// appointments, treatments, staff role assignments... hard-deleting one
// would be exactly the "everything downstream vanishes permanently"
// scenario we deliberately made a real, explicit decision about for
// patients earlier. Closing an outlet should never be that destructive
// by default.
export async function deleteLocation(
  locationId: string,
): Promise<DeleteLocationResult> {
  try {
    const session = await requireSession();

    if (!(await requireOwner(session.userId))) {
      return {
        success: false,
        error: "Only the organization owner can close an outlet.",
        code: "FORBIDDEN",
      };
    }

    const existing = await db.query.locations.findFirst({
      where: and(
        eq(locations.id, locationId),
        eq(locations.orgId, session.orgId),
      ),
    });
    if (!existing) {
      return { success: false, error: "Outlet not found.", code: "NOT_FOUND" };
    }

    await db
      .update(locations)
      .set({ isActive: false })
      .where(eq(locations.id, locationId));

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong closing the outlet.",
      code: "SERVER_ERROR",
    };
  }
}

// -------------- get Update ----------------------------
export type UpdateLocationResult =
  | { success: true; location: typeof locations.$inferSelect }
  | { success: false; error: string; code: LocationErrorCode };

export async function updateLocation(
  locationId: string,
  input: unknown,
): Promise<UpdateLocationResult> {
  try {
    const session = await requireSession();

    if (!(await requireOwner(session.userId))) {
      return {
        success: false,
        error: "Only the organization owner can edit outlets.",
        code: "FORBIDDEN",
      };
    }

    const parsed = updateLocationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }

    const existing = await db.query.locations.findFirst({
      where: and(
        eq(locations.id, locationId),
        eq(locations.orgId, session.orgId),
      ),
    });
    if (!existing) {
      return { success: false, error: "Outlet not found.", code: "NOT_FOUND" };
    }

    const [updated] = await db
      .update(locations)
      .set(parsed.data)
      .where(eq(locations.id, locationId))
      .returning();
    return { success: true, location: updated };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return {
        success: false,
        error: "An outlet with this name already exists.",
        code: "DUPLICATE",
      };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong updating the outlet.",
      code: "SERVER_ERROR",
    };
  }
}

// ---------------- get One -----------------------------------

export type GetLocationResult =
  | { success: true; location: typeof locations.$inferSelect }
  | { success: false; error: string; code: LocationErrorCode };

export async function getLocationById(locationId: string): Promise<GetLocationResult> {
  try {
    const session = await requireSession();

    const location = await db.query.locations.findFirst({
      where: and(eq(locations.id, locationId), eq(locations.orgId, session.orgId)),
    });
    if (!location) {
      return { success: false, error: "Outlet not found.", code: "NOT_FOUND" };
    }

    return { success: true, location };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the outlet.", code: "SERVER_ERROR" };
  }
}

export type BranchManagerRow = {
  userId: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string | null;
  locationId: string;
  locationName: string;
};

export type GetBranchManagersResult =
  | { success: true; managers: BranchManagerRow[] }
  | { success: false; error: string; code:LocationErrorCode };


export async function getBranchManagers(): Promise<GetBranchManagersResult> {
  try {
    const session = await requireSession();

    const rows = await db
      .select({
        userId: users.id,
        managerName: users.name,
        managerEmail: users.email,
        managerPhone: users.phone,
        locationId: locations.id,
        locationName: locations.name,
      })
      .from(userLocationRoles)
      .innerJoin(users, eq(userLocationRoles.userId, users.id))
      .innerJoin(locations, eq(userLocationRoles.locationId, locations.id))
      .where(
        and(
          eq(userLocationRoles.role, "manager"),
          eq(users.orgId, session.orgId),
          eq(users.isActive, true)
        )
      )
      .orderBy(locations.name);

    return { success: true, managers: rows };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading branch managers.", code: "SERVER_ERROR" };
  }
}
