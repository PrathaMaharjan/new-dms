import { GetAppointmentsResult } from "@/controller/appoments/controller";
import { db } from "@/db";
import {
  appointments,
  locations,
  patients,
  treatments,
  users,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { and, desc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
export async function getAppointments(
  locationId: string,
  options?: {
    doctorId?: string;
    status?: string;
    view?: "today" | "upcoming" | "checkin" | "completed" | "all";
    date?: string;
    limit?: number;
    offset?: number;
  },
): Promise<GetAppointmentsResult> {
  try {
    const session = await requireSession();

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(options?.offset ?? 0, 0);

    // "today" is the default tab whenever no view/status/date is specified
    // at all - matches this screen's own default selection.
    const view =
      options?.view ?? (options?.status || options?.date ? undefined : "today");

    const conditions = [
      eq(appointments.locationId, locationId),
      eq(locations.orgId, session.orgId),
      ne(appointments.status, "requested"),
    ];
    if (options?.doctorId) {
      conditions.push(eq(appointments.providerId, options.doctorId));
    }
    if (view === "checkin") {
      conditions.push(eq(appointments.status, "checked_in"));
    } else if (view === "completed") {
      conditions.push(eq(appointments.status, "completed"));
    } else if (view === "upcoming") {
      conditions.push(gt(appointments.startTime, new Date()));
      conditions.push(
        inArray(appointments.status, ["confirmed", "checked_in"]),
      );
    } else if (view === "today") {
      const todayStr = new Date().toISOString().slice(0, 10);
      const dayStart = new Date(`${todayStr}T00:00:00`);
      const dayEnd = new Date(`${todayStr}T23:59:59`);
      conditions.push(gt(appointments.startTime, dayStart));
      conditions.push(lt(appointments.startTime, dayEnd));
    } else if (view === "all") {
      // No extra status/time restriction - only the base conditions above
      // (still scoped to this location/org, still excluding "requested").
    } else if (options?.status) {
      conditions.push(eq(appointments.status, options.status as any));
    }
    // An explicit date always narrows further, even on top of a named
    // view - lets a caller ask for "today" or "upcoming" for a SPECIFIC
    // date rather than always relative to right now.
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
          patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
          patientPhone: patients.phone,
          patientEmail: patients.email,
          providerName: users.name,
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
