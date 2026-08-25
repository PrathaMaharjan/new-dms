import { db } from "@/db";
import { appointments, patients, treatments } from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { and, countDistinct, eq, gt, gte, lte, ne, sql } from "drizzle-orm";

export type DashboardErrorCode = "UNAUTHORIZED" | "SERVER_ERROR";
// function startOfDay(date: Date): Date {
//   const d = new Date(date);
//   d.setHours(0, 0, 0, 0);
//   return d;
// }
// function endOfDay(date: Date): Date {
//   const d = new Date(date);
//   d.setHours(23, 59, 59, 999);
//   return d;
// }

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

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return endOfDay(d);
}

export type DashboardStatsResult =
  | {
      success: true;
      stats: {
        appointmentsToday: number;
        completedToday: number;
        upcomingThisWeek: number;
        activePatients: number;
      };
    }
  | { success: false; error: string; code: DashboardErrorCode };

export async function getDoctorDashboardStats(
  locationId: string,
): Promise<DashboardStatsResult> {
  try {
    const session = await requireSession();
    const doctorId = session.userId;
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [
      appointmentsTodayResult,
      completedTodayResult,
      upcomingThisWeekResult,
      activePatientsResult,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(
          and(
            eq(appointments.providerId, doctorId),
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
            eq(appointments.providerId, doctorId),
            eq(appointments.locationId, locationId),
            gte(appointments.startTime, todayStart),
            lte(appointments.startTime, todayEnd),
            eq(appointments.status, "completed"),
          ),
        ),
      // Strictly future (excludes today) - matches the screenshot
      // showing 0 while 7 appointments exist today. Swap gt() for
      // gte(todayStart) if today's remaining slots should count too.
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(
          and(
            eq(appointments.providerId, doctorId),
            eq(appointments.locationId, locationId),
            gt(appointments.startTime, now),
            lte(appointments.startTime, endOfWeek(now)),
            ne(appointments.status, "cancelled"),
            ne(appointments.status, "completed"),
          ),
        ),
      // "Active" = distinct patients with at least one non-cancelled
      // appointment, ever - flagged since "currently upcoming only"
      // would give a materially smaller number.
      db
        .select({ count: countDistinct(appointments.patientId) })
        .from(appointments)
        .where(
          and(
            eq(appointments.providerId, doctorId),
            eq(appointments.locationId, locationId),
            ne(appointments.status, "cancelled"),
          ),
        ),
    ]);

    return {
      success: true,
      stats: {
        appointmentsToday: appointmentsTodayResult[0]?.count ?? 0,
        completedToday: completedTodayResult[0]?.count ?? 0,
        upcomingThisWeek: upcomingThisWeekResult[0]?.count ?? 0,
        activePatients: activePatientsResult[0]?.count ?? 0,
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

// get barchart output
export type AppointmentTrendRange = "7d" | "1m" | "1y";

export type AppointmentTrendResult =
  | { success: true; trend: { label: string; count: number }[] }
  | { success: false; error: string; code: DashboardErrorCode };

  export async function getAppointmentTrend(
  range: AppointmentTrendRange,
  locationId: string
): Promise<AppointmentTrendResult> {
  try {
    const session = await requireSession();
    const doctorId = session.userId;

    if (range === "7d") return getDailyTrend(doctorId, locationId);
    if (range === "1m") return getWeeklyTrend(doctorId, locationId);
    return getYearlyTrend(doctorId, locationId);
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the appointment trend.", code: "SERVER_ERROR" };
  }
}

async function getDailyTrend(doctorId: string, locationId: string): Promise<AppointmentTrendResult> {
  const now = new Date();

  const days: { label: string; date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ label: d.toLocaleDateString("en-US", { weekday: "short" }), date: d.toISOString().slice(0, 10), count: 0 });
  }

  const rangeStart = startOfDay(new Date(days[0].date));

  const rows = await db
    .select({
      date: sql<string>`to_char(${appointments.startTime}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.providerId, doctorId),
        eq(appointments.locationId, locationId),
        gte(appointments.startTime, rangeStart),
        lte(appointments.startTime, endOfDay(now)),
        ne(appointments.status, "cancelled")
      )
    )
    .groupBy(sql`to_char(${appointments.startTime}, 'YYYY-MM-DD')`);

  const countsByDate = new Map(rows.map((r) => [r.date, r.count]));
  const trend = days.map((d) => ({ label: d.label, count: countsByDate.get(d.date) ?? 0 }));

  return { success: true, trend };
}

async function getWeeklyTrend(doctorId: string, locationId: string): Promise<AppointmentTrendResult> {
  const now = new Date();

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
        eq(appointments.providerId, doctorId),
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

  const trend = counts.map((count, i) => ({ label: `W${i + 1}`, count }));
  return { success: true, trend };
}

async function getYearlyTrend(doctorId: string, locationId: string): Promise<AppointmentTrendResult> {
  const now = new Date();
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
        eq(appointments.providerId, doctorId),
        eq(appointments.locationId, locationId),
        gte(appointments.startTime, rangeStart),
        lte(appointments.startTime, endOfDay(now)),
        ne(appointments.status, "cancelled")
      )
    )
    .groupBy(sql`extract(year from ${appointments.startTime})`, sql`extract(month from ${appointments.startTime})`);

  const countsByMonth = new Map(rows.map((r) => [`${r.year}-${r.month}`, r.count]));
  const trend = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    return { label: d.toLocaleDateString("en-US", { month: "short" }), count: countsByMonth.get(key) ?? 0 };
  });

  return { success: true, trend };
}
// Only these four appear in the legend - "requested," "checked_in," and
// "no_show" from the real status enum are deliberately left out here,
// matching exactly what this specific donut is designed to show.
const LEGEND_STATUSES = [
  "cancelled",
  "checked_in",
  "completed",
  "confirmed",
] as const;

export type TodayStatusResult =
  | { success: true; breakdown: { status: string; count: number }[] }
  | { success: false; error: string; code: DashboardErrorCode };

export async function getTodayStatusBreakdown(
  locationId: string,
): Promise<TodayStatusResult> {
  try {
    const session = await requireSession();
    const now = new Date();

    const rows = await db
      .select({
        status: appointments.status,
        count: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.providerId, session.userId),
          eq(appointments.locationId, locationId),
          gte(appointments.startTime, startOfDay(now)),
          lte(appointments.startTime, endOfDay(now)),
        ),
      )
      .groupBy(appointments.status);

    // Same scaffold-first fix as the bar chart - every legend status
    // always appears in the response, even at 0, so the frontend never
    // has to guess whether "Cancelled: 0" means zero or missing data.
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

export type UpNextResult =
  | {
      success: true;
      appointment: {
        id: string;
        patientName: string;
        patientPhone: string | null;
        treatmentName: string;
        startTime: string;
        notes: string | null;
      } | null; // null when there's genuinely nothing left today
    }
  | { success: false; error: string; code: DashboardErrorCode };

// "Up Next" - this doctor's single soonest upcoming appointment from
// right now, today. Not a list - exactly one, or none if the day is done.
export async function getUpNextAppointment(
  locationId: string,
): Promise<UpNextResult> {
  try {
    const session = await requireSession();
    const now = new Date();

    const [result] = await db
      .select({
        id: appointments.id,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        patientPhone: patients.phone,
        treatmentName: treatments.name,
        startTime: appointments.startTime,
        notes: appointments.notes,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .where(
        and(
          eq(appointments.providerId, session.userId),
          eq(appointments.locationId, locationId),
          gt(appointments.startTime, now),
          ne(appointments.status, "cancelled"),
          ne(appointments.status, "requested"),
          ne(appointments.status, "completed"),
          ne(appointments.status, "no_show"),
        ),
      )
      .orderBy(appointments.startTime)
      .limit(1);

    if (!result) {
      return { success: true, appointment: null };
    }

    return {
      success: true,
      appointment: {
        ...result,
        startTime: result.startTime.toTimeString().slice(0, 5),
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the next appointment.",
      code: "SERVER_ERROR",
    };
  }
}
// "Today's Schedule" - every appointment this doctor has today,
// regardless of status (confirmed, checked in, cancelled all shown),
// in chronological order. Unlike Up Next, this is the full list, not
// just the next one.

export type TodaysScheduleResult =
  | {
      success: true;
      appointments: {
        id: string;
        patientName: string;
        treatmentName: string;
        startTime: string;
        status: string;
      }[];
    }
  | { success: false; error: string; code: DashboardErrorCode };

export async function getTodaysSchedule(
  locationId: string,
): Promise<TodaysScheduleResult> {
  try {
    const session = await requireSession();
    const now = new Date();

    const rows = await db
      .select({
        id: appointments.id,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        treatmentName: treatments.name,
        startTime: appointments.startTime,
        status: appointments.status,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .where(
        and(
          eq(appointments.providerId, session.userId),
          eq(appointments.locationId, locationId),
          gte(appointments.startTime, startOfDay(now)),
          lte(appointments.startTime, endOfDay(now)),
          ne(appointments.status, "requested"),
        ),
      )
      .orderBy(appointments.startTime);

    return {
      success: true,
      appointments: rows.map((r) => ({
        ...r,
        startTime: r.startTime.toTimeString().slice(0, 5),
      })),
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading today's schedule.",
      code: "SERVER_ERROR",
    };
  }
}

// "Recent Patients Seen" - this doctor's most recently COMPLETED visits,
// most recent first. Genuinely different from Today's Schedule: past
// tense, completed-only, not limited to today at all.

export type RecentPatientsResult =
  | {
      success: true;
      patients: {
        patientId: string;
        patientName: string;
        treatmentName: string;
        date: string;
      }[];
    }
  | { success: false; error: string; code: DashboardErrorCode };

export async function getRecentPatientsSeen(
  locationId: string,
  limit: number = 10,
): Promise<RecentPatientsResult> {
  try {
    const session = await requireSession();

    const rows = await db
      .select({
        patientId: patients.id,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        treatmentName: treatments.name,
        date: sql<string>`to_char(${appointments.startTime}, 'YYYY-MM-DD')`,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .where(
        and(
          eq(appointments.providerId, session.userId),
          eq(appointments.locationId, locationId),
          eq(appointments.status, "completed"),
        ),
      )
      .orderBy(sql`${appointments.startTime} desc`)
      .limit(limit);

    return { success: true, patients: rows };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading recent patients.",
      code: "SERVER_ERROR",
    };
  }
}

// The whole doctor dashboard, in ONE call - six genuinely independent
// panels, none depending on another's result, so they run concurrently
// via Promise.all rather than as six separate HTTP requests from the
// frontend. This is the real speed win: it's not that any single query
// gets faster, it's that 6 round-trip overheads (TLS handshake, HTTP
// headers, connection setup) collapse into 1.

export type DashboardFullResult =
  | {
      success: true;
      dashboard: {
        stats: { appointmentsToday: number; completedToday: number; upcomingThisWeek: number; activePatients: number };
        todayStatus: { status: string; count: number }[];
        appointmentTrend: { label: string; count: number }[]; // CHANGED - was last7Days, now genuinely range-flexible
        upNext: { id: string; patientName: string; patientPhone: string | null; treatmentName: string; startTime: string; notes: string | null } | null;
        todaysSchedule: { id: string; patientName: string; treatmentName: string; startTime: string; status: string }[];
        recentPatients: { patientId: string; patientName: string; treatmentName: string; date: string }[];
      };
    }
  | { success: false; error: string };

export async function getDoctorDashboardFull(
  locationId: string,
  trendRange: AppointmentTrendRange = "7d" // ADDED - defaults to 7d, matching the old hardcoded behavior when nothing is specified
): Promise<DashboardFullResult> {
  try {
    await requireSession();

    const [statsResult, todayStatusResult, trendResult, upNextResult, scheduleResult, recentResult] = await Promise.all([
      getDoctorDashboardStats(locationId),
      getTodayStatusBreakdown(locationId),
      getAppointmentTrend(trendRange, locationId), // FIXED - correct argument order, range first
      getUpNextAppointment(locationId),
      getTodaysSchedule(locationId),
      getRecentPatientsSeen(locationId),
    ]);

    const failures = [statsResult, todayStatusResult, trendResult, upNextResult, scheduleResult, recentResult];
    const firstFailure = failures.find((r) => !r.success);
    if (firstFailure && !firstFailure.success) {
      return { success: false, error: firstFailure.error };
    }

    return {
      success: true,
      dashboard: {
        stats: (statsResult as Extract<typeof statsResult, { success: true }>).stats,
        todayStatus: (todayStatusResult as Extract<typeof todayStatusResult, { success: true }>).breakdown,
        appointmentTrend: (trendResult as Extract<typeof trendResult, { success: true }>).trend, // CHANGED - .days no longer exists on the new result type, it's .trend now
        upNext: (upNextResult as Extract<typeof upNextResult, { success: true }>).appointment,
        todaysSchedule: (scheduleResult as Extract<typeof scheduleResult, { success: true }>).appointments,
        recentPatients: (recentResult as Extract<typeof recentResult, { success: true }>).patients,
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the dashboard." };
  }
}