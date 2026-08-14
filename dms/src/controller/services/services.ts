import { db } from "@/db";
import { appointmentTypes, locations } from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { serviceSchema, updateServiceSchema } from "@/lib/validators/services";
import { and, eq, sql } from "drizzle-orm";

export type ServiceErrorCode =
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

async function findOwnedService(serviceId: string, orgId: string) {
  const rows = await db
    .select({ id: appointmentTypes.id })
    .from(appointmentTypes)
    .innerJoin(locations, eq(appointmentTypes.locationId, locations.id))
    .where(and(eq(appointmentTypes.id, serviceId), eq(locations.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export type CreateServiceResult =
  | { success: true; service: typeof appointmentTypes.$inferSelect }
  | { success: false; error: string; code: ServiceErrorCode };

// createService — checks the location actually belongs to the caller's clinic, then adds a new service to it.
export async function createService(
  input: unknown,
): Promise<CreateServiceResult> {
  try {
    const session = await requireSession();

    const parsed = serviceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;

    const location = await db.query.locations.findFirst({
      where: and(
        eq(locations.id, data.locationId),
        eq(locations.orgId, session.orgId),
      ),
    });
    if (!location) {
      return {
        success: false,
        error: "Location not found.",
        code: "NOT_FOUND",
      };
    }

    const [service] = await db
      .insert(appointmentTypes)
      .values({
        locationId: data.locationId,
        name: data.name,
        durationMinutes: data.durationMinutes,
      })
      .returning();

    return { success: true, service };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return {
        success: false,
        error: "A service with this name already exists at this location.",
        code: "DUPLICATE",
      };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong creating the service.",
      code: "SERVER_ERROR",
    };
  }
}
//updateService — confirms you own the service before changing its name or duration. 
export type UpdateServiceResult =
  | { success: true; service: typeof appointmentTypes.$inferSelect }
  | { success: false; error: string; code: ServiceErrorCode };

  export async function updateService(serviceId: string, input: unknown): Promise<UpdateServiceResult> {
  try {
    const session = await requireSession();

    const parsed = updateServiceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }

    const owned = await findOwnedService(serviceId, session.orgId);
    if (!owned) {
      return { success: false, error: "Service not found.", code: "NOT_FOUND" };
    }

    const [updated] = await db
      .update(appointmentTypes)
      .set(parsed.data)
      .where(eq(appointmentTypes.id, serviceId))
      .returning();

    return { success: true, service: updated };
  }catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return { success: false, error: "A service with this name already exists at this location.", code: "DUPLICATE" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong creating the service.", code: "SERVER_ERROR" };
  }
}
// deleteService — confirms you own it, then removes it.

export type DeleteServiceResult = { success: true } | { success: false; error: string; code: ServiceErrorCode };

export async function deleteService(serviceId: string): Promise<DeleteServiceResult> {
  try {
    const session = await requireSession();

    const owned = await findOwnedService(serviceId, session.orgId);
    if (!owned) {
      return { success: false, error: "Service not found.", code: "NOT_FOUND" };
    }

    await db.delete(appointmentTypes).where(eq(appointmentTypes.id, serviceId));

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return { success: false, error: "A service with this name already exists at this location.", code: "DUPLICATE" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong creating the service.", code: "SERVER_ERROR" };
  }
}

export type GetServicesResult =
  | {
      success: true;
      services: (typeof appointmentTypes.$inferSelect)[];
      pagination: { total: number; limit: number; offset: number };
    }
  | { success: false; error: string; code: ServiceErrorCode };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// getServices — lists services for your clinic only, paginated, with a real total count.
export async function getServices(
  locationId?: string,
  options?: { limit?: number; offset?: number }
): Promise<GetServicesResult> {
  try {
    const session = await requireSession();

    const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(options?.offset ?? 0, 0);

    const whereClause = locationId
      ? and(eq(appointmentTypes.locationId, locationId), eq(locations.orgId, session.orgId))
      : eq(locations.orgId, session.orgId);

    const [results, countResult] = await Promise.all([
      db
        .select({
          id: appointmentTypes.id,
          locationId: appointmentTypes.locationId,
          name: appointmentTypes.name,
          durationMinutes: appointmentTypes.durationMinutes,
          createdAt: appointmentTypes.createdAt,
        })
        .from(appointmentTypes)
        .innerJoin(locations, eq(appointmentTypes.locationId, locations.id))
        .where(whereClause)
        .orderBy(appointmentTypes.name)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointmentTypes)
        .innerJoin(locations, eq(appointmentTypes.locationId, locations.id))
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    return { success: true, services: results, pagination: { total, limit, offset } };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return { success: false, error: "A service with this name already exists at this location.", code: "DUPLICATE" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong creating the service.", code: "SERVER_ERROR" };
  }
}