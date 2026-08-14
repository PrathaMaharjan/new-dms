import { db } from "@/db";
import {
  appointments,
  ledgerEntries,
  locations,
  patients,
  users,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { endOfDay, startOfDay } from "date-fns";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";

export type ErrorCode = "UNAUTHORIZED" | "SERVER_ERROR";
export type OrgBillingStatsResult =
  | {
      success: true;
      stats: {
        totalRevenueCents: number;
        totalCollectedCents: number;
        outstandingDuesCents: number;
        collectionRatePercent: number;
      };
    }
  | { success: false; error: string; code: ErrorCode };

// Org-wide by default, matching the "All outlets" selector - narrows to
// one specific outlet only if locationId is explicitly provided. Same
// math as the admin (single-location) billing stats, just scoped wider.
export async function getOrgBillingStats(
  locationId?: string,
): Promise<OrgBillingStatsResult> {
  try {
    const session = await requireSession();

    const conditions = [eq(patients.orgId, session.orgId)];
    if (locationId) {
      conditions.push(eq(patients.locationId, locationId));
    }

    const [totals] = await db
      .select({
        totalRevenueCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'charge'), 0)::int`,
        totalCollectedCents: sql<number>`abs(coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'payment'), 0))::int`,
      })
      .from(ledgerEntries)
      .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
      .where(and(...conditions));

    const totalRevenueCents = totals?.totalRevenueCents ?? 0;
    const totalCollectedCents = totals?.totalCollectedCents ?? 0;
    const outstandingDuesCents = Math.max(
      totalRevenueCents - totalCollectedCents,
      0,
    );

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

export type CollectionsRange = "7d" | "1m" | "6m" | "1y" | "all";

export type CollectionsChartResult =
  | { success: true; chart: { label: string; amountCents: number }[] }
  | { success: false; error: string; code: ErrorCode };

// Org-wide by default - narrows to one outlet only if locationId is
// explicitly passed, same optional-scope pattern as getRevenueByDoctor.
export async function getCollectionsChart(
  range: CollectionsRange,
  locationId?: string,
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

async function getDailyCollections(
  orgId: string,
  locationId?: string,
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

  const conditions = [
    eq(patients.orgId, orgId),
    eq(ledgerEntries.type, "payment"),
    gte(ledgerEntries.createdAt, startOfDay(new Date(scaffold[0].date))),
    lte(ledgerEntries.createdAt, endOfDay(now)),
  ];
  if (locationId) conditions.push(eq(patients.locationId, locationId));

  const rows = await db
    .select({
      date: sql<string>`to_char(${ledgerEntries.createdAt}, 'YYYY-MM-DD')`,
      amountCents: sql<number>`abs(sum(${ledgerEntries.amountCents}))::int`,
    })
    .from(ledgerEntries)
    .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
    .where(and(...conditions))
    .groupBy(sql`to_char(${ledgerEntries.createdAt}, 'YYYY-MM-DD')`);

  const byDate = new Map(rows.map((r) => [r.date, r.amountCents]));
  return {
    success: true,
    chart: scaffold.map((d) => ({
      label: d.label,
      amountCents: byDate.get(d.date) ?? 0,
    })),
  };
}

async function getWeeklyCollections(
  orgId: string,
  locationId?: string,
): Promise<CollectionsChartResult> {
  const now = new Date();
  const weekStarts: Date[] = [];
  for (let i = 3; i >= 0; i--) {
    const d = startOfDay(new Date(now));
    d.setDate(d.getDate() - i * 7 - 6);
    weekStarts.push(d);
  }

  const conditions = [
    eq(patients.orgId, orgId),
    eq(ledgerEntries.type, "payment"),
    gte(ledgerEntries.createdAt, weekStarts[0]),
    lte(ledgerEntries.createdAt, endOfDay(now)),
  ];
  if (locationId) conditions.push(eq(patients.locationId, locationId));

  const rows = await db
    .select({
      createdAt: ledgerEntries.createdAt,
      amountCents: ledgerEntries.amountCents,
    })
    .from(ledgerEntries)
    .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
    .where(and(...conditions));

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

  return {
    success: true,
    chart: totals.map((amountCents, i) => ({
      label: `W${i + 1}`,
      amountCents,
    })),
  };
}

async function getMonthlyCollections(
  orgId: string,
  locationId: string | undefined,
  monthCount: number,
): Promise<CollectionsChartResult> {
  const now = new Date();
  const rangeStart = new Date(
    now.getFullYear(),
    now.getMonth() - (monthCount - 1),
    1,
  );

  const conditions = [
    eq(patients.orgId, orgId),
    eq(ledgerEntries.type, "payment"),
    gte(ledgerEntries.createdAt, rangeStart),
    lte(ledgerEntries.createdAt, endOfDay(now)),
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

export type PaymentMethodMixResult =
  | { success: true; breakdown: { method: string; amountCents: number }[] }
  | { success: false; error: string; code: ErrorCode };

export async function getPaymentMethodMix(
  locationId?: string,
): Promise<PaymentMethodMixResult> {
  try {
    const session = await requireSession();

    const conditions = [
      eq(patients.orgId, session.orgId),
      eq(ledgerEntries.type, "payment"),
    ];
    if (locationId) conditions.push(eq(patients.locationId, locationId));

    const rows = await db
      .select({
        method: ledgerEntries.paymentMethod,
        amountCents: sql<number>`abs(sum(${ledgerEntries.amountCents}))::int`,
      })
      .from(ledgerEntries)
      .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
      .where(and(...conditions))
      .groupBy(ledgerEntries.paymentMethod);

    const breakdown = rows
      .filter(
        (r: any): r is { method: string; amountCents: number } =>
          r.method !== null,
      )
      .map((r:any) => ({ method: r.method, amountCents: r.amountCents }));

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

export type OutletPerformanceResult =
  | {
      success: true;
      outlets: {
        locationId: string;
        outletName: string;
        chargedCents: number;
        collectedCents: number;
        outstandingCents: number;
        collectionRatePercent: number;
      }[];
    }
  | { success: false; error: string; code: ErrorCode };

export async function getOutletPerformance(): Promise<OutletPerformanceResult> {
  try {
    const session = await requireSession();

    const rows = await db
      .select({
        locationId: locations.id,
        outletName: locations.name,
        chargedCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'charge'), 0)::int`,
        collectedCents: sql<number>`abs(coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'payment'), 0))::int`,
      })
      .from(locations)
      .leftJoin(patients, eq(patients.locationId, locations.id))
      .leftJoin(ledgerEntries, eq(ledgerEntries.patientId, patients.id))
      .where(eq(locations.orgId, session.orgId))
      .groupBy(locations.id, locations.name)
      .orderBy(locations.name);

    const outlets = rows.map((r) => {
      const outstandingCents = Math.max(r.chargedCents - r.collectedCents, 0);
      const collectionRatePercent =
        r.chargedCents > 0
          ? Math.round((r.collectedCents / r.chargedCents) * 1000) / 10
          : 0;
      return { ...r, outstandingCents, collectionRatePercent };
    });

    return { success: true, outlets };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading outlet performance.",
      code: "SERVER_ERROR",
    };
  }
}

export type RevenueByDoctorResult =
  | {
      success: true;
      doctors: { doctorId: string; doctorName: string; revenueCents: number }[];
    }
  | { success: false; error: string; code: ErrorCode };

// Org-wide, across EVERY outlet - not locationId-scoped like the admin
// billing panels. A charge only counts here if it's linked to a real
// appointment (appointments.providerId is how we know WHICH doctor it
// belongs to) - a walk-in charge with no appointmentId genuinely can't be
// attributed to any specific doctor, and is correctly excluded.
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
  | { success: false; error: string; code: ErrorCode };

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

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

// getAll
export type AllOrganizationDashboardResult =
  | {
      success: true;
      dashboard: {
        billingStats: {
          totalRevenueCents: number;
          totalCollectedCents: number;
          outstandingDuesCents: number;
          collectionRatePercent: number;
        };
        collectionsChart: { label: string; amountCents: number }[];
        paymentMethodMix: { method: string; amountCents: number }[];
        outletPerformance: {
          locationId: string;
          outletName: string;
          chargedCents: number;
          collectedCents: number;
          outstandingCents: number;
          collectionRatePercent: number;
        }[];
        revenueByDoctor: {
          doctorId: string;
          doctorName: string;
          revenueCents: number;
        }[];
        topOutstanding: {
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
        };
      };
    }
  | { success: false; error: string };
export async function getAllOrganizationDashboard(options?: {
  locationId?: string;
  chartRange?: CollectionsRange;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<AllOrganizationDashboardResult> {
  try {
    await requireSession();
    const [
      billingStatsResult,
      collectionsChartResult,
      paymentMethodMixResult,
      outletPerformanceResult,
      revenueByDoctorResult,
      topOutstandingResult,
    ] = await Promise.all([
      getOrgBillingStats(options?.locationId),
      getCollectionsChart(options?.chartRange ?? "7d", options?.locationId),
      getPaymentMethodMix(options?.locationId),
      getOutletPerformance(),
      getRevenueByDoctor(options?.locationId),
      getTopOutstandingPatients({
        locationId: options?.locationId,
        search: options?.search,
        limit: options?.limit,
        offset: options?.offset,
      }),
    ]);

    const failures = [
      billingStatsResult,
      collectionsChartResult,
      paymentMethodMixResult,
      outletPerformanceResult,
      revenueByDoctorResult,
      topOutstandingResult,
    ];
    const firstFailure = failures.find((r) => !r.success);
    if (firstFailure && !firstFailure.success) {
      return { success: false, error: firstFailure.error };
    }

    return {
      success: true,
      dashboard: {
        billingStats: (
          billingStatsResult as Extract<
            typeof billingStatsResult,
            { success: true }
          >
        ).stats,
        collectionsChart: (
          collectionsChartResult as Extract<
            typeof collectionsChartResult,
            { success: true }
          >
        ).chart,
        paymentMethodMix: (
          paymentMethodMixResult as Extract<
            typeof paymentMethodMixResult,
            { success: true }
          >
        ).breakdown,
        outletPerformance: (
          outletPerformanceResult as Extract<
            typeof outletPerformanceResult,
            { success: true }
          >
        ).outlets,
        revenueByDoctor: (
          revenueByDoctorResult as Extract<
            typeof revenueByDoctorResult,
            { success: true }
          >
        ).doctors,
        topOutstanding: {
          patients: (
            topOutstandingResult as Extract<
              typeof topOutstandingResult,
              { success: true }
            >
          ).patients,
          pagination: (
            topOutstandingResult as Extract<
              typeof topOutstandingResult,
              { success: true }
            >
          ).pagination,
        },
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the organization dashboard.",
    };
  }
}