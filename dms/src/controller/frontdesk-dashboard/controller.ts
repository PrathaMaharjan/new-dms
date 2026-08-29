import { db } from "@/db";
import { appointments, patients, treatments, userLocationRoles, users } from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { and, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";

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
// ---------- Appointments Trend (7 Days, 30 Days, 1 Year) (clinic-wide) ----------
export type FrontDeskTrendItem = { label: string; day?: string; date?: string; count: number };

export type FrontDeskChartResult =
  | { success: true; days: FrontDeskTrendItem[]; trend: FrontDeskTrendItem[] }
  | { success: false; error: string; code: FrontDeskErrorCode };

export async function getFrontDeskAppointmentTrend(
  locationId: string,
  range: "7days" | "30days" | "1year" | "7d" | "1m" | "1y" = "7days"
): Promise<FrontDeskChartResult> {
  try {
    await requireSession();
    const normalizedRange =
      range === "1m" ? "30days" : range === "1y" ? "1year" : range === "7d" ? "7days" : range;

    const now = new Date();

    if (normalizedRange === "30days") {
      const weekStarts: Date[] = [];
      for (let i = 3; i >= 0; i--) {
        const d = startOfDay(new Date(now));
        d.setDate(d.getDate() - i * 7 - 6);
        weekStarts.push(d);
      }

      const rangeStart = weekStarts[0];

      const rows = await db
        .select({ startTime: appointments.startTime })
        .from(appointments)
        .where(
          and(
            eq(appointments.locationId, locationId),
            gte(appointments.startTime, rangeStart),
            lte(appointments.startTime, endOfDay(now)),
            ne(appointments.status, "cancelled")
          )
        );

      const counts = [0, 0, 0, 0];
      for (const row of rows) {
        for (let i = 3; i >= 0; i--) {
          const weekStart = weekStarts[i];
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          if (row.startTime >= weekStart && row.startTime < weekEnd) {
            counts[i]++;
            break;
          }
        }
      }

      const trend: FrontDeskTrendItem[] = counts.map((count, i) => ({
        label: `Week ${i + 1}`,
        count,
      }));

      return { success: true, days: trend, trend };
    }

    if (normalizedRange === "1year") {
      const rangeStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

      const rows = await db
        .select({
          year: sql<number>`extract(year from ${appointments.startTime})::int`,
          month: sql<number>`extract(month from ${appointments.startTime})::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.locationId, locationId),
            gte(appointments.startTime, rangeStart),
            lte(appointments.startTime, endOfDay(now)),
            ne(appointments.status, "cancelled")
          )
        )
        .groupBy(
          sql`extract(year from ${appointments.startTime})`,
          sql`extract(month from ${appointments.startTime})`
        );

      const countsByMonth = new Map(rows.map((r) => [`${r.year}-${r.month}`, r.count]));
      const trend: FrontDeskTrendItem[] = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
        return {
          label: d.toLocaleDateString("en-US", { month: "short" }),
          count: countsByMonth.get(key) ?? 0,
        };
      });

      return { success: true, days: trend, trend };
    }

    // Default: 7 days
    const days: { label: string; day: string; date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const dayNum = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${dayNum}`;
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      days.push({
        label: dayName,
        day: dayName,
        date: dateStr,
        count: 0,
      });
    }

    const sevenDaysAgo = startOfDay(new Date(now));
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const rows = await db
      .select({
        startTime: appointments.startTime,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.locationId, locationId),
          gte(appointments.startTime, sevenDaysAgo),
          lte(appointments.startTime, endOfDay(now)),
          ne(appointments.status, "cancelled"),
          ne(appointments.status, "requested"),
        )
      );

    const countsByDate = new Map<string, number>();
    for (const row of rows) {
      const d = row.startTime instanceof Date ? row.startTime : new Date(row.startTime);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const dayNum = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${dayNum}`;
      countsByDate.set(dateStr, (countsByDate.get(dateStr) || 0) + 1);
    }

    const merged = days.map((d) => ({
      ...d,
      count: countsByDate.get(d.date) ?? 0,
    }));

    return { success: true, days: merged, trend: merged };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the appointment trend.",
      code: "SERVER_ERROR",
    };
  }
}

export const getFrontDeskLast7Days = getFrontDeskAppointmentTrend;

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
          or(eq(users.isActive, true), isNull(users.isActive)),
          isNull(users.deletedAt),
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
        patientName: sql<string>`coalesce(${patients.firstName} || ' ' || ${patients.lastName}, 'Patient')`,
        doctorName: sql<string>`coalesce(${users.name}, 'Doctor')`,
        treatmentName: sql<string>`coalesce(${treatments.name}, 'General Consultation')`,
        startTime: appointments.startTime,
        status: appointments.status,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(users, eq(appointments.providerId, users.id))
      .leftJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .where(
        and(
          eq(appointments.locationId, locationId),
          gte(appointments.startTime, startOfDay(now)),
          lte(appointments.startTime, endOfDay(now)),
          ne(appointments.status, "cancelled")
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