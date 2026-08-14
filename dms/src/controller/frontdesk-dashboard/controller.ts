import { db } from "@/db";
import { appointments, patients, treatments, userLocationRoles, users } from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { and, eq, gte, lte, ne, sql } from "drizzle-orm";

export type FrontDeskErrorCode = "UNAUTHORIZED" | "SERVER_ERROR";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
// ---------- Stat cards: Appointments Today, Pending Requests, Checked In, No-Shows ----------

export type FrontDeskStatsResult =
  | {
      success: true;
      stats: {
        appointmentsToday: number;
        pendingRequests: number;
        checkedIn: number;
        noShowsToday: number;
      };
    }
  | { success: false; error: string; code: FrontDeskErrorCode };

export async function getFrontDeskStats(
  locationId: string,
): Promise<FrontDeskStatsResult> {
  try {
    const session = await requireSession();
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    // No providerId filter anywhere here - front desk sees the WHOLE
    // clinic's numbers, not one doctor's own. That's the core difference
    // from every doctor-dashboard query this reuses the shape of.
    const [
      appointmentsTodayResult,
      pendingResult,
      checkedInResult,
      noShowResult,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(
          and(
            eq(appointments.locationId, locationId),
            gte(appointments.startTime, todayStart),
            lte(appointments.startTime, todayEnd),
            ne(appointments.status, "cancelled"),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(
          and(
            eq(appointments.locationId, locationId),
            eq(appointments.status, "requested"),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(
          and(
            eq(appointments.locationId, locationId),
            gte(appointments.startTime, todayStart),
            lte(appointments.startTime, todayEnd),
            eq(appointments.status, "checked_in"),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(
          and(
            eq(appointments.locationId, locationId),
            gte(appointments.startTime, todayStart),
            lte(appointments.startTime, todayEnd),
            eq(appointments.status, "no_show"),
          ),
        ),
    ]);
    return {
      success: true,
      stats: {
        appointmentsToday: appointmentsTodayResult[0]?.count ?? 0,
        pendingRequests: pendingResult[0]?.count ?? 0,
        checkedIn: checkedInResult[0]?.count ?? 0,
        noShowsToday: noShowResult[0]?.count ?? 0,
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading dashboard stats.",
      code: "SERVER_ERROR",
    };
  }
}
// ---------- Appointments For Last 7 Days (clinic-wide) ----------
export type FrontDeskChartResult =
  | { success: true; days: { day: string; date: string; count: number }[] }
  | { success: false; error: string; code: FrontDeskErrorCode };

export async function getFrontDeskLast7Days(
  locationId: string,
): Promise<FrontDeskChartResult> {
  try {
    await requireSession();
    const now = new Date();

    const days: { day: string; date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        date: d.toISOString().slice(0, 10),
        count: 0,
      });
    }

    const sevenDaysAgo = startOfDay(new Date(days[0].date));
    const rows = await db
      .select({
        date: sql<string>`to_char(${appointments.startTime}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.locationId, locationId),
          gte(appointments.startTime, sevenDaysAgo),
          lte(appointments.startTime, endOfDay(now)),
          ne(appointments.status, "cancelled"),
        ),
      )
      .groupBy(sql`to_char(${appointments.startTime}, 'YYYY-MM-DD')`);

    const countsByDate = new Map(rows.map((r) => [r.date, r.count]));
    const merged = days.map((d) => ({
      ...d,
      count: countsByDate.get(d.date) ?? 0,
    }));

    return { success: true, days: merged };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the weekly chart.",
      code: "SERVER_ERROR",
    };
  }
}

// ---------- Today's Status donut (clinic-wide) ----------

const LEGEND_STATUSES = [
  "cancelled",
  "checked_in",
  "completed",
  "confirmed",
] as const;

export type FrontDeskTodayStatusResult =
  | { success: true; breakdown: { status: string; count: number }[] }
  | { success: false; error: string; code: FrontDeskErrorCode };

export async function getFrontDeskTodayStatus(
  locationId: string,
): Promise<FrontDeskTodayStatusResult> {
  try {
    await requireSession();
    const now = new Date();
    const rows = await db
      .select({
        status: appointments.status,
        count: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.locationId, locationId),
          gte(appointments.startTime, startOfDay(now)),
          lte(appointments.startTime, endOfDay(now)),
        ),
      )
      .groupBy(appointments.status);

    const countsByStatus = new Map(rows.map((r) => [r.status, r.count]));
    const breakdown = LEGEND_STATUSES.map((status) => ({
      status,
      count: countsByStatus.get(status) ?? 0,
    }));

    return { success: true, breakdown };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading today's status.",
      code: "SERVER_ERROR",
    };
  }
}

// ---------- Doctor Load Today - genuinely new, no equivalent exists yet ----------

export type DoctorLoadResult =
  | {
      success: true;
      doctors: {
        doctorId: string;
        doctorName: string;
        appointmentCount: number;
      }[];
    }
  | { success: false; error: string; code: FrontDeskErrorCode };

export async function getDoctorLoadToday(
  locationId: string,
): Promise<DoctorLoadResult> {
  try {
    const session = await requireSession();
    const now = new Date();

    // Every active clinical doctor at this location - LEFT joined against
    // today's appointments, so a doctor with zero bookings still shows
    // up at 0 (matching "John rai" and "haha" both at 0 appts in the
    // screenshot), rather than silently disappearing from the list.
    const rows = await db
      .select({
        doctorId: users.id,
        doctorName: users.name,
        appointmentCount: sql<number>`count(${appointments.id}) filter (where ${appointments.status} != 'cancelled')::int`,
      })
      .from(users)
      .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
      .leftJoin(
        appointments,
        and(
          eq(appointments.providerId, users.id),
          eq(appointments.locationId, locationId),
          gte(appointments.startTime, startOfDay(now)),
          lte(appointments.startTime, endOfDay(now)),
        ),
      )
      .where(
        and(
          eq(userLocationRoles.locationId, locationId),
          eq(userLocationRoles.role, "clinical"),
          eq(users.orgId, session.orgId),
          eq(users.isActive, true),
        ),
      )
      .groupBy(users.id, users.name)
      .orderBy(
        sql`count(${appointments.id}) filter (where ${appointments.status} != 'cancelled') desc`,
      );

    return { success: true, doctors: rows };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading doctor load.",
      code: "SERVER_ERROR",
    };
  }
}

// ---------- Today's Schedule (clinic-wide, includes doctor name) ----------

export type FrontDeskScheduleResult =
  | {
      success: true;
      appointments: {
        id: string;
        patientName: string;
        doctorName: string;
        treatmentName: string;
        startTime: string;
        status: string;
      }[];
    }
  | { success: false; error: string; code: FrontDeskErrorCode };

  export async function getFrontDeskTodaysSchedule(locationId: string): Promise<FrontDeskScheduleResult> {
  try {
    await requireSession();
    const now = new Date();

    const rows = await db
      .select({
        id: appointments.id,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        doctorName: users.name,
        treatmentName: treatments.name,
        startTime: appointments.startTime,
        status: appointments.status,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(appointments.providerId, users.id))
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .where(
        and(
          eq(appointments.locationId, locationId),
          gte(appointments.startTime, startOfDay(now)),
          lte(appointments.startTime, endOfDay(now))
        )
      )
      .orderBy(appointments.startTime);

    return {
      success: true,
      appointments: rows.map((r) => ({ ...r, startTime: r.startTime.toTimeString().slice(0, 5) })),
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading today's schedule.", code: "SERVER_ERROR" };
  }
}