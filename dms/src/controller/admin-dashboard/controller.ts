import { db } from "@/db";
import {
  appointments,
  ledgerEntries,
  locations,
  patients,
  providerSchedules,
  treatments,
  userLocationRoles,
  users,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { and, desc, eq, gte, isNotNull, lte, ne, sql } from "drizzle-orm";

export type AdminDashboardErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "SERVER_ERROR";

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

// ---------- Stat cards: Total Patients, Appointments Today, Active Doctors, Pending Requests ----------

export type AdminStatsResult =
  | {
    success: true;
    stats: {
      totalPatients: number;
      appointmentsToday: number;
      activeDoctors: number;
      pendingRequests: number;
    };
  }
  | { success: false; error: string; code: AdminDashboardErrorCode };

// export async function getAdminDashboardStats(
//   locationId: string,
// ): Promise<AdminStatsResult> {
//   try {
//     const session = await requireSession();
//     const now = new Date();
//     // Scoped to ONE specific outlet, not the whole org - same locationId
//     // pattern as the front-desk and doctor dashboards, not a third style.
//     const [
//       totalPatientsResult,
//       appointmentsTodayResult,
//       activeDoctorsResult,
//       pendingResult,
//     ] = await Promise.all([
//       db
//         .select({ count: sql<number>`count(*)::int` })

//         .from(patients)
//         .where(
//           and(
//             eq(patients.orgId, session.orgId),
//             eq(patients.locationId, locationId),
//             sql`${patients.deletedAt} is null`,
//           ),
//         ),
//       db
//         .select({ count: sql<number>`count(*)::int` })
//         .from(appointments)
//         .where(
//           and(
//             eq(appointments.locationId, locationId),
//             gte(appointments.startTime, startOfDay(now)),
//             lte(appointments.startTime, endOfDay(now)),
//             sql`${appointments.status} != 'cancelled'`,
//           ),
//         ),
//       db
//         .select({ count: sql<number>`count(distinct ${users.id})::int` })
//         .from(users)
//         .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
//         .where(
//           and(
//             eq(users.orgId, session.orgId),
//             eq(userLocationRoles.locationId, locationId),
//             eq(userLocationRoles.role, "clinical"),
//             eq(users.isActive, true),
//           ),
//         ),
//       db
//         .select({ count: sql<number>`count(*)::int` })
//         .from(appointments)

//         .where(
//           and(
//             eq(appointments.locationId, locationId),
//             eq(appointments.status, "requested"),
//           ),
//         ),
//     ]);
//     return {
//       success: true,
//       stats: {
//         totalPatients: totalPatientsResult[0]?.count ?? 0,
//         appointmentsToday: appointmentsTodayResult[0]?.count ?? 0,
//         activeDoctors: activeDoctorsResult[0]?.count ?? 0,
//         pendingRequests: pendingResult[0]?.count ?? 0,
//       },
//     };
//   } catch (err) {
//     if (err instanceof SessionError) {
//       return { success: false, error: err.message, code: "UNAUTHORIZED" };
//     }
//     console.error(err);
//     return {
//       success: false,
//       error: "Something went wrong loading dashboard stats.",
//       code: "SERVER_ERROR",
//     };
//   }
// }

// treatment popularity


export async function getAdminDashboardStats(locationId?: string): Promise<AdminStatsResult> {
  try {
    const session = await requireSession();
    const now = new Date();

    // Same optional-scope pattern already used for getRevenueByDoctor /
    // getTopOutstandingPatients - org-wide by default, narrows to one
    // outlet only when locationId is explicitly provided.
    const [totalPatientsResult, appointmentsTodayResult, activeDoctorsResult, pendingResult] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(patients)
        .where(
          and(
            eq(patients.orgId, session.orgId),
            locationId ? eq(patients.locationId, locationId) : undefined,
            sql`${patients.deletedAt} is null`
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .innerJoin(locations, eq(appointments.locationId, locations.id))
        .where(
          and(
            eq(locations.orgId, session.orgId),
            locationId ? eq(appointments.locationId, locationId) : undefined,
            gte(appointments.startTime, startOfDay(now)),
            lte(appointments.startTime, endOfDay(now)),
            sql`${appointments.status} != 'cancelled'`
          )
        ),
      // count(distinct users.id) already deduplicates a doctor holding
      // clinical roles at multiple locations - omitting the location
      // filter here doesn't risk counting anyone twice.
      db
        .select({ count: sql<number>`count(distinct ${users.id})::int` })
        .from(users)
        .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
        .where(
          and(
            eq(users.orgId, session.orgId),
            locationId ? eq(userLocationRoles.locationId, locationId) : undefined,
            eq(userLocationRoles.role, "clinical"),
            eq(users.isActive, true)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .innerJoin(locations, eq(appointments.locationId, locations.id))
        .where(
          and(
            eq(locations.orgId, session.orgId),
            locationId ? eq(appointments.locationId, locationId) : undefined,
            eq(appointments.status, "requested")
          )
        ),
    ]);

    return {
      success: true,
      stats: {
        totalPatients: totalPatientsResult[0]?.count ?? 0,
        appointmentsToday: appointmentsTodayResult[0]?.count ?? 0,
        activeDoctors: activeDoctorsResult[0]?.count ?? 0,
        pendingRequests: pendingResult[0]?.count ?? 0,
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading dashboard stats.", code: "SERVER_ERROR" };
  }
}







export type TreatmentPopularityResult =
  | { success: true; breakdown: { treatmentName: string; count: number }[] }
  | { success: false; error: string; code: AdminDashboardErrorCode };

export async function getTreatmentPopularity(locationId?: string): Promise<TreatmentPopularityResult> {
  try {
    const session = await requireSession();

    // appointments has no direct orgId column - org-wide scoping (or
    // even confirming a SPECIFIC locationId genuinely belongs to this
    // caller's org) has to go through a join to locations, same reasoning
    // used everywhere else in this project.
    const rows = await db
      .select({
        treatmentName: treatments.name,
        count: sql<number>`count(*)::int`,
      })
      .from(appointments)
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .innerJoin(locations, eq(appointments.locationId, locations.id))
      .where(
        and(
          eq(locations.orgId, session.orgId),
          locationId ? eq(appointments.locationId, locationId) : undefined,
          sql`${appointments.status} != 'cancelled'`
        )
      )
      .groupBy(treatments.name)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return { success: true, breakdown: rows };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading treatment popularity.", code: "SERVER_ERROR" };
  }
}

// ---------- New Patient Registrations Trend ----------

export type TrendRange = "7d" | "14d" | "1m" | "1y";

export type PatientTrendResult =
  | { success: true; trend: { label: string; count: number }[] }
  | { success: false; error: string; code: AdminDashboardErrorCode };

export async function getNewPatientTrend(
  range: TrendRange,
  locationId?: string,  // CHANGED: was required, now optional
): Promise<PatientTrendResult> {
  try {
    const session = await requireSession();
    const now = new Date();

    if (range === "7d" || range === "14d") {
      return await getDailyTrend(session.orgId, locationId, range === "7d" ? 7 : 14, now);
    } else if (range === "1m") {
      return await getWeeklyTrend(session.orgId, locationId, now);
    } else {
      return await getMonthlyTrend(session.orgId, locationId, now);
    }
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the patient trend.", code: "SERVER_ERROR" };
  }
}

// ---------- 7 Days / 14 Days - one point per calendar day ----------

async function getDailyTrend(
  orgId: string,
  locationId: string | undefined,  // CHANGED: was required
  days: number,
  now: Date,
): Promise<PatientTrendResult> {
  const scaffold: { label: string; date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    scaffold.push({ label: `Day ${days - i}`, date: d.toISOString().slice(0, 10), count: 0 });
  }

  const rangeStart = startOfDay(new Date(scaffold[0].date));
  const rows = await db
    .select({
      date: sql<string>`to_char(${patients.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(patients)
    .where(
      and(
        eq(patients.orgId, orgId),
        locationId ? eq(patients.locationId, locationId) : undefined,  // CHANGED: now conditional
        gte(patients.createdAt, rangeStart),
        lte(patients.createdAt, endOfDay(now)),
      ),
    )
    .groupBy(sql`to_char(${patients.createdAt}, 'YYYY-MM-DD')`);

  const countsByDate = new Map(rows.map((r) => [r.date, r.count]));
  const trend = scaffold.map((d) => ({ label: d.label, count: countsByDate.get(d.date) ?? 0 }));

  return { success: true, trend };
}

// ---------- 1 Month - one point per week: W1, W2, W3, W4 ----------

async function getWeeklyTrend(
  orgId: string,
  locationId: string | undefined,  // CHANGED: was required
  now: Date,
): Promise<PatientTrendResult> {
  const weekStarts: Date[] = [];
  for (let i = 3; i >= 0; i--) {
    const d = startOfDay(new Date(now));
    d.setDate(d.getDate() - i * 7 - 6);
    weekStarts.push(d);
  }

  const rangeStart = weekStarts[0];
  const rows = await db
    .select({ createdAt: patients.createdAt })
    .from(patients)
    .where(
      and(
        eq(patients.orgId, orgId),
        locationId ? eq(patients.locationId, locationId) : undefined,  // CHANGED: now conditional
        gte(patients.createdAt, rangeStart),
        lte(patients.createdAt, endOfDay(now)),
      ),
    );

  const counts = [0, 0, 0, 0];
  for (const row of rows) {
    const created = row.createdAt;
    for (let i = 3; i >= 0; i--) {
      const weekStart = weekStarts[i];
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      if (created >= weekStart && created < weekEnd) {
        counts[i]++;
        break;
      }
    }
  }

  const trend = counts.map((count, i) => ({ label: `W${i + 1}`, count }));
  return { success: true, trend };
}

// ---------- 1 Year - one point per calendar month: Jan..Dec ----------

async function getMonthlyTrend(
  orgId: string,
  locationId: string | undefined,  // CHANGED: was required
  now: Date,
): Promise<PatientTrendResult> {
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const rows = await db
    .select({
      month: sql<string>`to_char(${patients.createdAt}, 'Mon')`,
      monthNum: sql<number>`extract(month from ${patients.createdAt})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(patients)
    .where(
      and(
        eq(patients.orgId, orgId),
        locationId ? eq(patients.locationId, locationId) : undefined,  // CHANGED: now conditional
        gte(patients.createdAt, yearStart),
        lte(patients.createdAt, endOfDay(now)),
      ),
    )
    .groupBy(sql`to_char(${patients.createdAt}, 'Mon')`, sql`extract(month from ${patients.createdAt})`);

  const countsByMonth = new Map(rows.map((r) => [r.monthNum, r.count]));
  const trend = Array.from({ length: 12 }, (_, i) => {
    const label = new Date(2000, i, 1).toLocaleDateString("en-US", { month: "short" });
    return { label, count: countsByMonth.get(i + 1) ?? 0 };
  });

  return { success: true, trend };
}

// doctor-utilization
export type DoctorUtilizationResult =
  | {
    success: true;
    doctors: {
      doctorId: string;
      name: string;
      bookedSlots: number;
      openSlots: number;
      percentBooked: number;
    }[];
  }
  | { success: false; error: string; code: AdminDashboardErrorCode };

// "Doctor Utilization & Open Slots" - reuses the exact same shift-to-slots
// math as findAvailableDoctor/getDoctorScheduleStatus earlier: shift
// length in minutes / 30 = total slots, minus how many are actually
// booked today.

export async function getDoctorUtilization(
  locationId: string,
): Promise<DoctorUtilizationResult> {
  try {
    const session = await requireSession();
    const now = new Date();
    const dayOfWeek = now.getDay();

    const doctorRows = await db
      .select({
        id: users.id,
        name: users.name,
        startTime: providerSchedules.startTime,
        endTime: providerSchedules.endTime,
      })
      .from(users)
      .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
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
        ),
      );
    const doctorIds = doctorRows.map((d) => d.id);
    const bookedRows = doctorIds.length
      ? await db
        .select({
          providerId: appointments.providerId,
          count: sql<number>`count(*)::int`,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.locationId, locationId),
            gte(appointments.startTime, startOfDay(now)),
            lte(appointments.startTime, endOfDay(now)),
            ne(appointments.status, "cancelled"),
          ),
        )
        .groupBy(appointments.providerId)
      : [];
    const bookedByDoctor = new Map(
      bookedRows.map((b) => [b.providerId, b.count]),
    );

    const doctors = doctorRows.map((d) => {
      const booked = bookedByDoctor.get(d.id) ?? 0;

      if (!d.startTime || !d.endTime) {
        return {
          doctorId: d.id,
          name: d.name,
          bookedSlots: booked,
          openSlots: 0,
          percentBooked: booked > 0 ? 100 : 0,
        };
      }

      const [startH, startM] = d.startTime.split(":").map(Number);
      const [endH, endM] = d.endTime.split(":").map(Number);
      const totalMinutes = endH * 60 + endM - (startH * 60 + startM);
      const totalSlots = Math.max(Math.floor(totalMinutes / 30), 1);
      const openSlots = Math.max(totalSlots - booked, 0);
      const percentBooked = Math.round(
        (Math.min(booked, totalSlots) / totalSlots) * 100,
      );

      return {
        doctorId: d.id,
        name: d.name,
        bookedSlots: booked,
        openSlots,
        percentBooked,
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
      error: "Something went wrong loading doctor utilization.",
      code: "SERVER_ERROR",
    };
  }
}

// today appoment -----------------------

export type TodaysAppointmentsResult =
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
  | { success: false; error: string; code: AdminDashboardErrorCode };

export async function getTodaysAppointmentsAcrossDoctors(
  locationId?: string,
): Promise<TodaysAppointmentsResult> {
  try {
  const session =  await requireSession();
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
      .innerJoin(locations, eq(appointments.locationId, locations.id)) 
      .where(
        and(
          eq(locations.orgId, session.orgId),
          locationId ? eq(appointments.locationId, locationId) : undefined, 
          gte(appointments.startTime, startOfDay(now)),
          lte(appointments.startTime, endOfDay(now)),
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
      error: "Something went wrong loading today's appointments.",
      code: "SERVER_ERROR",
    };
  }
}

export type ActivityFeedErrorCode = "UNAUTHORIZED" | "SERVER_ERROR";

export type ActivityItem = {
  type:
  | "appointment_booked"
  | "patient_registered"
  | "treatment_added"
  | "schedule_updated";
  title: string;
  description: string;
  timestamp: Date;
};

export type ActivityFeedResult =
  | { success: true; activities: ActivityItem[] }
  | { success: false; error: string; code: ActivityFeedErrorCode };

// Derived from existing createdAt timestamps across 4 tables - NOT a
// real activity log. Genuinely can't reconstruct "Appointment Cancelled"
// this way, since nothing records WHEN a status changed, only what it
// currently is. A true activity feed needs a dedicated audit table that
// every action writes to - this is a working approximation until then.
export async function getRecentActivityFeed(
  locationId?: string,
  limit: number = 10,
): Promise<ActivityFeedResult> {
  try {
    const session = await requireSession();  // unchanged, already captured

    const [recentAppointments, recentPatients, recentTreatments, recentSchedules] = await Promise.all([
      db
        .select({
          patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
          doctorName: users.name,
          treatmentName: treatments.name,
          createdAt: appointments.createdAt,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(users, eq(appointments.providerId, users.id))
        .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
        .innerJoin(locations, eq(appointments.locationId, locations.id))  // ADDED: needed to reach orgId
        .where(
          and(
            eq(locations.orgId, session.orgId),  // ADDED: the actual missing security check
            locationId ? eq(appointments.locationId, locationId) : undefined,  // CHANGED: now conditional, was unconditional + broken against the optional param
          ),
        )
        .orderBy(desc(appointments.createdAt))
        .limit(limit),
      db
        .select({
          patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
          createdAt: patients.createdAt,
        })
        .from(patients)
        .where(
          and(
            eq(patients.orgId, session.orgId),  // ADDED: patients HAS a direct orgId column, so no join needed here
            locationId ? eq(patients.locationId, locationId) : undefined,  // CHANGED: now conditional
          ),
        )
        .orderBy(desc(patients.createdAt))
        .limit(limit),
      db
        .select({ name: treatments.name, createdAt: treatments.createdAt })
        .from(treatments)
        .innerJoin(locations, eq(treatments.locationId, locations.id))  // ADDED: treatments has no orgId column either
        .where(
          and(
            eq(locations.orgId, session.orgId),  // ADDED
            locationId ? eq(treatments.locationId, locationId) : undefined,  // CHANGED: now conditional
          ),
        )
        .orderBy(desc(treatments.createdAt))
        .limit(limit),
      db
        .select({ doctorName: users.name, createdAt: providerSchedules.createdAt })
        .from(providerSchedules)
        .innerJoin(users, eq(providerSchedules.userId, users.id))
        .innerJoin(locations, eq(providerSchedules.locationId, locations.id))  // ADDED
        .where(
          and(
            eq(locations.orgId, session.orgId),  // ADDED
            locationId ? eq(providerSchedules.locationId, locationId) : undefined,  // CHANGED: now conditional
          ),
        )
        .orderBy(desc(providerSchedules.createdAt))
        .limit(limit),
    ]);

    const activities: ActivityItem[] = [
      ...recentAppointments.map((a) => ({
        type: "appointment_booked" as const,
        title: "New Appointment Booked",
        description: `Patient ${a.patientName} booked for ${a.treatmentName} with ${a.doctorName}`,
        timestamp: a.createdAt,
      })),
      ...recentPatients.map((p) => ({
        type: "patient_registered" as const,
        title: "New Patient Registered",
        description: `${p.patientName} created a new profile`,
        timestamp: p.createdAt,
      })),
      ...recentTreatments.map((t) => ({
        type: "treatment_added" as const,
        title: "Treatment Added",
        description: `New service added: ${t.name}`,
        timestamp: t.createdAt,
      })),
      ...recentSchedules.map((s) => ({
        type: "schedule_updated" as const,
        title: "Doctor Working Hours Updated",
        description: `${s.doctorName} updated their working hours`,
        timestamp: s.createdAt,
      })),
    ];

    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return { success: true, activities: activities.slice(0, limit) };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the activity feed.", code: "SERVER_ERROR" };
  }
}

// getAll
export type AdminDoctorPanelResult =
  | {
    success: true;
    panel: {
      doctorUtilization: {
        doctorId: string;
        name: string;
        bookedSlots: number;
        openSlots: number;
        percentBooked: number;
      }[];
      todaysAppointments: {
        id: string;
        patientName: string;
        doctorName: string;
        treatmentName: string;
        startTime: string;
        status: string;
      }[];
      activityFeed: {
        type: string;
        title: string;
        description: string;
        timestamp: Date;
      }[];
    };
  }
  | { success: false; error: string };

// Everything on this specific screen (Doctor Utilization, Today's
// Appointments Across Doctors, Recent Activity Feed) in one call - three
// genuinely independent panels, run concurrently rather than as three
// separate frontend requests.
export async function getAllAdminDoctorPanel(
  locationId: string,
): Promise<AdminDoctorPanelResult> {
  try {
    await requireSession(); // fail fast, once, before running three queries for nothing

    const [utilizationResult, appointmentsResult, activityResult] =
      await Promise.all([
        getDoctorUtilization(locationId),
        getTodaysAppointmentsAcrossDoctors(locationId),
        getRecentActivityFeed(locationId, 10),
      ]);

    const failures = [utilizationResult, appointmentsResult, activityResult];
    const firstFailure = failures.find((r) => !r.success);
    if (firstFailure && !firstFailure.success) {
      return { success: false, error: firstFailure.error };
    }

    return {
      success: true,
      panel: {
        doctorUtilization: (
          utilizationResult as Extract<
            typeof utilizationResult,
            { success: true }
          >
        ).doctors,
        todaysAppointments: (
          appointmentsResult as Extract<
            typeof appointmentsResult,
            { success: true }
          >
        ).appointments,
        activityFeed: (
          activityResult as Extract<typeof activityResult, { success: true }>
        ).activities,
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the dashboard panel.",
    };
  }
}

// ---------------------------------------------- Billing PART ------------------------------------------------------------------------

export type AdminBillingErrorCode = "UNAUTHORIZED" | "SERVER_ERROR";

export type AdminBillingStatsResult =
  | {
    success: true;
    stats: {
      totalRevenueCents: number;
      totalCollectedCents: number;
      outstandingDuesCents: number;
      collectionRatePercent: number;
    };
  }
  | { success: false; error: string; code: AdminBillingErrorCode };

// "Total Revenue" here is the same underlying figure as "Total Charged"
// on the front-desk billing screen (getBillingStats) - relabeled for this
// admin-level framing, since revenue = collected + still-outstanding.
// Collection Rate is the one genuinely new metric this dashboard adds.
export async function getAdminBillingStats(
  locationId: string,
): Promise<AdminBillingStatsResult> {
  try {
    const session = await requireSession();

    const [totals] = await db
      .select({
        totalRevenueCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'charge'), 0)::int`,
        totalCollectedCents: sql<number>`abs(coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'payment'), 0))::int`,
      })
      .from(ledgerEntries)
      .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
      .where(
        and(
          eq(patients.orgId, session.orgId),
          eq(patients.locationId, locationId),
        ),
      );

    const totalRevenueCents = totals?.totalRevenueCents ?? 0;
    const totalCollectedCents = totals?.totalCollectedCents ?? 0;
    const outstandingDuesCents = Math.max(
      totalRevenueCents - totalCollectedCents,
      0,
    );
    // Guard against division by zero for a brand-new location with no
    // billing activity yet - 0% is the honest answer, not NaN.
    const collectionRatePercent =
      totalRevenueCents > 0
        ? Math.round((totalCollectedCents / totalRevenueCents) * 1000) / 10
        : 0;

    return {
      success: true,
      stats: {
        totalRevenueCents,
        totalCollectedCents,
        outstandingDuesCents,
        collectionRatePercent,
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading billing stats.",
      code: "SERVER_ERROR",
    };
  }
}

// ---------- Payment Method Mix donut ----------
export type PaymentMethodMixResult =
  | { success: true; breakdown: { method: string; amountCents: number }[] }
  | { success: false; error: string; code: AdminBillingErrorCode };

export async function getPaymentMethodMix(
  locationId: string,
): Promise<PaymentMethodMixResult> {
  try {
    const session = await requireSession();

    const rows = await db
      .select({
        method: ledgerEntries.paymentMethod,
        amountCents: sql<number>`abs(sum(${ledgerEntries.amountCents}))::int`,
      })
      .from(ledgerEntries)
      .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
      .where(
        and(
          eq(patients.orgId, session.orgId),
          eq(patients.locationId, locationId),
          eq(ledgerEntries.type, "payment"),
        ),
      )
      .groupBy(ledgerEntries.paymentMethod);


    const breakdown = rows
      .filter(
        (r: any): r is { method: string; amountCents: number } =>
          r.method !== null,
      )
      .map((r: any) => ({ method: r.method, amountCents: r.amountCents }));

    return { success: true, breakdown };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading payment method mix.",
      code: "SERVER_ERROR",
    };
  }
}

// -------------------------- get BarChart Data -----------------------------------------------
export type CollectionsErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "SERVER_ERROR";

export type CollectionsRange = "7d" | "1m" | "6m" | "1y" | "all";

export type CollectionsChartResult =
  | { success: true; chart: { label: string; amountCents: number }[] }
  | { success: false; error: string; code: CollectionsErrorCode };

// ---------- 7d - real weekday names, matching the screenshot exactly ----------

async function getDailyCollections(
  orgId: string,
  locationId: string,
): Promise<CollectionsChartResult> {
  const now = new Date();
  const scaffold: { label: string; date: string; amountCents: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    scaffold.push({
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      date: d.toISOString().slice(0, 10),
      amountCents: 0,
    });
  }
  const rangeStart = startOfDay(new Date(scaffold[0].date));
  const rows = await db
    .select({
      date: sql<string>`to_char(${ledgerEntries.createdAt}, 'YYYY-MM-DD')`,
      amountCents: sql<number>`abs(sum(${ledgerEntries.amountCents}))::int`,
    })
    .from(ledgerEntries)
    .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
    .where(
      and(
        eq(patients.orgId, orgId),
        eq(patients.locationId, locationId),
        eq(ledgerEntries.type, "payment"),
        gte(ledgerEntries.createdAt, rangeStart),
        lte(ledgerEntries.createdAt, endOfDay(now)),
      ),
    )
    .groupBy(sql`to_char(${ledgerEntries.createdAt}, 'YYYY-MM-DD')`);

  const byDate = new Map(rows.map((r) => [r.date, r.amountCents]));
  const chart = scaffold.map((d) => ({
    label: d.label,
    amountCents: byDate.get(d.date) ?? 0,
  }));

  return { success: true, chart };
}

// ---------- 1m - W1..W4, same bucketing pattern as the patient trend chart ----------

async function getWeeklyCollections(
  orgId: string,
  locationId: string,
): Promise<CollectionsChartResult> {
  const now = new Date();

  const weekStarts: Date[] = [];
  for (let i = 3; i >= 0; i--) {
    const d = startOfDay(new Date(now));
    d.setDate(d.getDate() - i * 7 - 6);
    weekStarts.push(d);
  }
  const rows = await db
    .select({
      createdAt: ledgerEntries.createdAt,
      amountCents: ledgerEntries.amountCents,
    })
    .from(ledgerEntries)
    .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
    .where(
      and(
        eq(patients.orgId, orgId),
        eq(patients.locationId, locationId),
        eq(ledgerEntries.type, "payment"),
        gte(ledgerEntries.createdAt, weekStarts[0]),
        lte(ledgerEntries.createdAt, endOfDay(now)),
      ),
    );
  const totals = [0, 0, 0, 0];
  for (const row of rows) {
    for (let i = 3; i >= 0; i--) {
      const weekEnd = new Date(weekStarts[i]);
      weekEnd.setDate(weekEnd.getDate() + 7);
      if (row.createdAt >= weekStarts[i] && row.createdAt < weekEnd) {
        totals[i] += Math.abs(row.amountCents);
        break;
      }
    }
  }

  const chart = totals.map((amountCents, i) => ({
    label: `W${i + 1}`,
    amountCents,
  }));
  return { success: true, chart };
}

async function getMonthlyCollections(
  orgId: string,
  locationId: string,
  monthCount: number,
): Promise<CollectionsChartResult> {
  const now = new Date();
  const rangeStart = new Date(
    now.getFullYear(),
    now.getMonth() - (monthCount - 1),
    1,
  );

  const rows = await db
    .select({
      year: sql<number>`extract(year from ${ledgerEntries.createdAt})::int`,
      month: sql<number>`extract(month from ${ledgerEntries.createdAt})::int`,
      amountCents: sql<number>`abs(sum(${ledgerEntries.amountCents}))::int`,
    })
    .from(ledgerEntries)
    .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
    .where(
      and(
        eq(patients.orgId, orgId),
        eq(patients.locationId, locationId),
        eq(ledgerEntries.type, "payment"),
        gte(ledgerEntries.createdAt, rangeStart),
        lte(ledgerEntries.createdAt, endOfDay(now)),
      ),
    )
    .groupBy(
      sql`extract(year from ${ledgerEntries.createdAt})`,
      sql`extract(month from ${ledgerEntries.createdAt})`,
    );
  const byKey = new Map(
    rows.map((r) => [`${r.year}-${r.month}`, r.amountCents]),
  );

  const chart: { label: string; amountCents: number }[] = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    chart.push({
      label: d.toLocaleDateString("en-US", { month: "short" }),
      amountCents: byKey.get(key) ?? 0,
    });
  }

  return { success: true, chart };
}

// "Collections" sums only PAYMENT-type entries - actual money received,
// not charges billed or discounts given, matching the panel's own label.
export async function getCollectionsChart(
  locationId: string,
  range: CollectionsRange,
): Promise<CollectionsChartResult> {
  try {
    const session = await requireSession();

    if (range === "7d") return getDailyCollections(session.orgId, locationId);
    if (range === "1m") return getWeeklyCollections(session.orgId, locationId);
    if (range === "6m")
      return getMonthlyCollections(session.orgId, locationId, 6);
    if (range === "all") return getAllTimeCollections(session.orgId, locationId);
    return getMonthlyCollections(session.orgId, locationId, 12);
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading collections.",
      code: "SERVER_ERROR",
    };
  }
}

async function getAllTimeCollections(
  orgId: string,
  locationId?: string,
): Promise<CollectionsChartResult> {
  const conditions = [
    eq(patients.orgId, orgId),
    eq(ledgerEntries.type, "payment"),
  ];
  if (locationId) conditions.push(eq(patients.locationId, locationId));

  const rows = await db
    .select({
      year: sql<number>`extract(year from ${ledgerEntries.createdAt})::int`,
      month: sql<number>`extract(month from ${ledgerEntries.createdAt})::int`,
      amountCents: sql<number>`abs(sum(${ledgerEntries.amountCents}))::int`,
    })
    .from(ledgerEntries)
    .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
    .where(and(...conditions))
    .groupBy(
      sql`extract(year from ${ledgerEntries.createdAt})`,
      sql`extract(month from ${ledgerEntries.createdAt})`,
    )
    .orderBy(
      sql`extract(year from ${ledgerEntries.createdAt}) asc`,
      sql`extract(month from ${ledgerEntries.createdAt}) asc`,
    );

  if (rows.length === 0) {
    return { success: true, chart: [] };
  }

  const uniqueYears = new Set(rows.map((r) => r.year));
  const showYear = uniqueYears.size > 1;

  const chart = rows.map((r) => {
    const d = new Date(r.year, r.month - 1, 1);
    const label = showYear
      ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
      : d.toLocaleDateString("en-US", { month: "short" });
    return {
      label,
      amountCents: r.amountCents,
    };
  });

  return { success: true, chart };
}

// ------------------ doctor stats ---------------------------------------

export type RevenueByDoctorResult =
  | {
      success: true;
      doctors: { doctorId: string; doctorName: string; revenueCents: number }[];
    }
  | { success: false; error: string; code: AdminBillingErrorCode };

export async function getRevenueByDoctor(
  locationId?: string,
): Promise<RevenueByDoctorResult> {
  try {
    const session = await requireSession();

    const conditions = [
      eq(patients.orgId, session.orgId),
      eq(ledgerEntries.type, "charge"),
      isNotNull(ledgerEntries.appointmentId),
      eq(users.isOwner, false),
    ];
    // Narrows to ONE outlet only if explicitly asked for - omitted
    // entirely, this stays org-wide across every location, exactly
    // matching the screenshot's default behavior.
    if (locationId) {
      conditions.push(eq(patients.locationId, locationId));
    }

    const rows = await db
      .select({
        doctorId: users.id,
        doctorName: users.name,
        revenueCents: sql<number>`sum(${ledgerEntries.amountCents})::int`,
      })
      .from(ledgerEntries)
      .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
      .innerJoin(appointments, eq(ledgerEntries.appointmentId, appointments.id))
      .innerJoin(users, eq(appointments.providerId, users.id))
      .where(and(...conditions))
      .groupBy(users.id, users.name)
      .orderBy(sql`sum(${ledgerEntries.amountCents}) desc`);

    return { success: true, doctors: rows };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading revenue by doctor.",
      code: "SERVER_ERROR",
    };
  }
}
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;
export type TopOutstandingResult =
  | {
    success: true;
    patients: {
      patientId: string;
      patientName: string;
      patientPhone: string | null;
      outletName: string;
      lastActivity: Date | null;
      chargedCents: number;
      paidCents: number;
      balanceCents: number;
    }[];
    pagination: { total: number; limit: number; offset: number };
  }
  | { success: false; error: string; code: AdminBillingErrorCode };
// top out;et patent
export async function getTopOutstandingPatients(options?: {
  locationId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<TopOutstandingResult> {
  try {
    const session = await requireSession();

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(options?.offset ?? 0, 0);

    const conditions = [eq(patients.orgId, session.orgId)];
    if (options?.locationId) {
      conditions.push(eq(patients.locationId, options.locationId));
    }
    if (options?.search) {
      conditions.push(
        sql`(${patients.firstName} || ' ' || ${patients.lastName} ilike ${"%" + options.search + "%"} or ${patients.phone} ilike ${"%" + options.search + "%"})`,
      );
    }

    const allRows = await db
      .select({
        patientId: patients.id,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        patientPhone: patients.phone,
        outletName: locations.name,
        lastActivity: sql<Date | null>`max(${ledgerEntries.createdAt})`,
        chargedCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'charge'), 0)::int`,
        paidCents: sql<number>`abs(coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'payment'), 0))::int`,
        balanceCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::int`,
      })
      .from(patients)
      .innerJoin(locations, eq(patients.locationId, locations.id))
      .leftJoin(ledgerEntries, eq(ledgerEntries.patientId, patients.id))
      .where(and(...conditions))
      .groupBy(
        patients.id,
        patients.firstName,
        patients.lastName,
        patients.phone,
        locations.name,
      );

    const withDues = allRows
      .filter((p) => p.balanceCents > 0)
      .sort((a, b) => b.balanceCents - a.balanceCents);
    const total = withDues.length;
    const paged = withDues.slice(offset, offset + limit);

    return {
      success: true,
      patients: paged,
      pagination: { total, limit, offset },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading outstanding patients.",
      code: "SERVER_ERROR",
    };
  }
}
