import { db } from "@/db";
import { AnalyticsRange } from "../controller";
import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import {
  expenses,
  inventoryMovements,
  ledgerEntries,
  locations,
  organizations,
  patients,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";

export type OwnerDashboardErrorCode = "UNAUTHORIZED" | "SERVER_ERROR";

function getRangeStart(range: AnalyticsRange): Date | null {
  const now = new Date();
  if (range === "6m")
    return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  if (range === "1y")
    return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  return null; // "all" - no lower bound
}

//------------------------------------------- stats -------------------------------------------------
export type OwnerDashboardStats = {
  revenueCents: number;
  totalExpenseCents: number; // restocks + manual expenses - wastage still excluded, open decision
  netProfitCents: number;
};

export type OwnerDashboardStatsResult =
  | { success: true; stats: OwnerDashboardStats }
  | { success: false; error: string; code: OwnerDashboardErrorCode };

export async function getOwnerDashboardStats(
  range: AnalyticsRange,
  locationId?: string,
): Promise<OwnerDashboardStatsResult> {
  try {
    const session = await requireSession();
    const rangeStart = getRangeStart(range);

    const revenueConditions = [
      eq(ledgerEntries.orgId, session.orgId),
      eq(ledgerEntries.type, "charge"),
    ];
    if (locationId) revenueConditions.push(eq(ledgerEntries.locationId, locationId));
    if (rangeStart)
      revenueConditions.push(gte(ledgerEntries.createdAt, rangeStart));

    const expenseConditions = [
      eq(expenses.orgId, session.orgId),
      isNull(expenses.deletedAt),
    ];
    if (locationId) expenseConditions.push(eq(expenses.locationId, locationId));
    if (rangeStart)
      expenseConditions.push(
        sql`${expenses.expenseDate} >= ${rangeStart.toISOString().slice(0, 10)}`,
      );

    const purchaseConditions = [
      eq(locations.orgId, session.orgId),
      eq(inventoryMovements.type, "received"),
      isNotNull(inventoryMovements.costCents),
    ];
    if (locationId)
      purchaseConditions.push(eq(inventoryMovements.locationId, locationId));
    if (rangeStart)
      purchaseConditions.push(gte(inventoryMovements.createdAt, rangeStart));

    const [revenueRow, expenseRow, purchaseRow] = await Promise.all([
      db
        .select({
          total: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::int`,
        })
        .from(ledgerEntries)
        .where(and(...revenueConditions)),
      db
        .select({
          total: sql<number>`coalesce(sum(${expenses.amountCents}), 0)::int`,
        })
        .from(expenses)
        .where(and(...expenseConditions)),
      db
        .select({
          total: sql<number>`coalesce(sum(${inventoryMovements.costCents}), 0)::int`,
        })
        .from(inventoryMovements)
        .innerJoin(locations, eq(inventoryMovements.locationId, locations.id))
        .where(and(...purchaseConditions)),
    ]);
    const revenueCents = revenueRow[0]?.total ?? 0;
    const totalExpenseCents =
      (expenseRow[0]?.total ?? 0) + (purchaseRow[0]?.total ?? 0);
    const netProfitCents = revenueCents - totalExpenseCents;

    return {
      success: true,
      stats: { revenueCents, totalExpenseCents, netProfitCents },
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

// ---------- Revenue vs Expense chart ----------

export type OwnerDashboardChartPoint = {
  label: string;
  revenueCents: number;
  expenseCents: number;
  netCents: number;
};

export type RevenueVsExpenseResult =
  | { success: true; chart: OwnerDashboardChartPoint[] }
  | { success: false; error: string; code: OwnerDashboardErrorCode };

export async function getRevenueVsExpense(
  range: AnalyticsRange,
  locationId?: string,
): Promise<RevenueVsExpenseResult> {
  try {
    const session = await requireSession();

    if (range === "6m") return buildMonthlyChart(session.orgId, 6, locationId);
    if (range === "1y") return buildMonthlyChart(session.orgId, 12, locationId);

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, session.orgId),
    });
    const now = new Date();
    const orgStart = org ? org.createdAt : new Date(now.getFullYear(), 0, 1);
    const months =
      (now.getFullYear() - orgStart.getFullYear()) * 12 +
      (now.getMonth() - orgStart.getMonth()) +
      1;
    const monthCount = Math.max(12, months);

    return buildMonthlyChart(session.orgId, monthCount, locationId);
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the chart.",
      code: "SERVER_ERROR",
    };
  }
}
async function buildMonthlyChart(
  orgId: string,
  monthCount: number,
  locationId?: string,
): Promise<RevenueVsExpenseResult> {
  const now = new Date();
  const rangeStart = new Date(
    now.getFullYear(),
    now.getMonth() - (monthCount - 1),
    1,
  );

  const revenueConditions = [
    eq(ledgerEntries.orgId, orgId),
    eq(ledgerEntries.type, "charge"),
    gte(ledgerEntries.createdAt, rangeStart),
  ];
  if (locationId) revenueConditions.push(eq(ledgerEntries.locationId, locationId));

  const expenseConditions = [
    eq(expenses.orgId, orgId),
    isNull(expenses.deletedAt),
    sql`${expenses.expenseDate} >= ${rangeStart.toISOString().slice(0, 10)}`,
  ];
  if (locationId) expenseConditions.push(eq(expenses.locationId, locationId));

  const purchaseConditions = [
    eq(locations.orgId, orgId),
    eq(inventoryMovements.type, "received"),
    isNotNull(inventoryMovements.costCents),
    gte(inventoryMovements.createdAt, rangeStart),
  ];
  if (locationId)
    purchaseConditions.push(eq(inventoryMovements.locationId, locationId));

  const [trendRevenue, trendExpense, trendPurchase] = await Promise.all([
    db
      .select({
        year: sql<number>`extract(year from ${ledgerEntries.createdAt})::int`,
        month: sql<number>`extract(month from ${ledgerEntries.createdAt})::int`,
        total: sql<number>`sum(${ledgerEntries.amountCents})::int`,
      })
      .from(ledgerEntries)
      .where(and(...revenueConditions))
      .groupBy(
        sql`extract(year from ${ledgerEntries.createdAt})`,
        sql`extract(month from ${ledgerEntries.createdAt})`,
      ),
    db
      .select({
        year: sql<number>`extract(year from ${expenses.expenseDate})::int`,
        month: sql<number>`extract(month from ${expenses.expenseDate})::int`,
        total: sql<number>`sum(${expenses.amountCents})::int`,
      })
      .from(expenses)
      .where(and(...expenseConditions))
      .groupBy(
        sql`extract(year from ${expenses.expenseDate})`,
        sql`extract(month from ${expenses.expenseDate})`,
      ),
    db
      .select({
        year: sql<number>`extract(year from ${inventoryMovements.createdAt})::int`,
        month: sql<number>`extract(month from ${inventoryMovements.createdAt})::int`,
        total: sql<number>`sum(${inventoryMovements.costCents})::int`,
      })
      .from(inventoryMovements)
      .innerJoin(locations, eq(inventoryMovements.locationId, locations.id))
      .where(and(...purchaseConditions))
      .groupBy(
        sql`extract(year from ${inventoryMovements.createdAt})`,
        sql`extract(month from ${inventoryMovements.createdAt})`,
      ),
  ]);
  const revByKey = new Map(
    trendRevenue.map((r) => [`${r.year}-${r.month}`, r.total]),
  );
  const expByKey = new Map(
    trendExpense.map((r) => [`${r.year}-${r.month}`, r.total]),
  );
  const purByKey = new Map(
    trendPurchase.map((r) => [`${r.year}-${r.month}`, r.total]),
  );

  const chart: OwnerDashboardChartPoint[] = Array.from(
    { length: monthCount },
    (_, i) => {
      const d = new Date(
        rangeStart.getFullYear(),
        rangeStart.getMonth() + i,
        1,
      );
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const rev = revByKey.get(key) ?? 0;
      const exp = (expByKey.get(key) ?? 0) + (purByKey.get(key) ?? 0);
      return {
        label: d.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        revenueCents: rev,
        expenseCents: exp,
        netCents: rev - exp,
      };
    },
  );

  return { success: true, chart };
}

async function buildYearlyChart(
  orgId: string,
  locationId?: string,
): Promise<RevenueVsExpenseResult> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });
  if (!org) {
    return {
      success: false,
      error: "Organization not found.",
      code: "SERVER_ERROR",
    };
  }

  const startYear = org.createdAt.getFullYear();
  const currentYear = new Date().getFullYear();

  const revenueConditions = [
    eq(patients.orgId, orgId),
    eq(ledgerEntries.type, "charge"),
  ];
  if (locationId) revenueConditions.push(eq(patients.locationId, locationId));

  const expenseConditions = [
    eq(expenses.orgId, orgId),
    isNull(expenses.deletedAt),
  ];
  if (locationId) expenseConditions.push(eq(expenses.locationId, locationId));

  const purchaseConditions = [
    eq(locations.orgId, orgId),
    eq(inventoryMovements.type, "received"),
    isNotNull(inventoryMovements.costCents),
  ];
  if (locationId)
    purchaseConditions.push(eq(inventoryMovements.locationId, locationId));

  const [trendRevenue, trendExpense, trendPurchase] = await Promise.all([
    db
      .select({
        year: sql<number>`extract(year from ${ledgerEntries.createdAt})::int`,
        total: sql<number>`sum(${ledgerEntries.amountCents})::int`,
      })
      .from(ledgerEntries)
      .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
      .where(and(...revenueConditions))
      .groupBy(sql`extract(year from ${ledgerEntries.createdAt})`),
    db
      .select({
        year: sql<number>`extract(year from ${expenses.expenseDate})::int`,
        total: sql<number>`sum(${expenses.amountCents})::int`,
      })
      .from(expenses)
      .where(and(...expenseConditions))
      .groupBy(sql`extract(year from ${expenses.expenseDate})`),
    db
      .select({
        year: sql<number>`extract(year from ${inventoryMovements.createdAt})::int`,
        total: sql<number>`sum(${inventoryMovements.costCents})::int`,
      })
      .from(inventoryMovements)
      .innerJoin(locations, eq(inventoryMovements.locationId, locations.id))
      .where(and(...purchaseConditions))
      .groupBy(sql`extract(year from ${inventoryMovements.createdAt})`),
  ]);
  const revByYear = new Map(trendRevenue.map((r) => [r.year, r.total]));
  const expByYear = new Map(trendExpense.map((r) => [r.year, r.total]));
  const purByYear = new Map(trendPurchase.map((r) => [r.year, r.total]));

  const chart: OwnerDashboardChartPoint[] = [];
  for (let year = startYear; year <= currentYear; year++) {
    const rev = revByYear.get(year) ?? 0;
    const exp = (expByYear.get(year) ?? 0) + (purByYear.get(year) ?? 0);
    chart.push({
      label: String(year),
      revenueCents: rev,
      expenseCents: exp,
      netCents: rev - exp,
    });
  }

  return { success: true, chart };
}

export type BreakdownRow = {
  label: string;
  revenueCents: number;
  purchaseExpCents: number;
  wastageExpCents: number;
  manualExpCents: number;
  totalExpenseCents: number;
  netProfitCents: number;
};

export type BreakdownResult =
  | {
      success: true;
      rows: BreakdownRow[];
      pagination: { total: number; limit: number; offset: number };
    }
  | { success: false; error: string; code: OwnerDashboardErrorCode };

const BREAKDOWN_PAGE_SIZE = 8;

export async function getBreakdown(
  range: AnalyticsRange,
  locationId: string | undefined,
  offset: number = 0,
): Promise<BreakdownResult> {
  try {
    const session = await requireSession();
    const now = new Date();
    let monthCount: number;
    let rangeStart: Date;

    if (range === "6m") {
      monthCount = 6;
      rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    } else if (range === "1y") {
      monthCount = 12;
      rangeStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    } else {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, session.orgId),
      });
      const orgStart = org ? org.createdAt : new Date(now.getFullYear(), 0, 1);
      rangeStart = new Date(orgStart.getFullYear(), orgStart.getMonth(), 1);
      monthCount =
        (now.getFullYear() - rangeStart.getFullYear()) * 12 +
        (now.getMonth() - rangeStart.getMonth()) +
        1;
      if (monthCount < 12) {
        monthCount = 12;
        rangeStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      }
    }

    const revenueConditions = [
      eq(ledgerEntries.orgId, session.orgId),
      eq(ledgerEntries.type, "charge"),
      gte(ledgerEntries.createdAt, rangeStart),
    ];
    if (locationId) revenueConditions.push(eq(ledgerEntries.locationId, locationId));
    const manualExpenseConditions = [
      eq(expenses.orgId, session.orgId),
      isNull(expenses.deletedAt),
      sql`${expenses.expenseDate} >= ${rangeStart.toISOString().slice(0, 10)}`,
    ];
    if (locationId)
      manualExpenseConditions.push(eq(expenses.locationId, locationId));

    const purchaseConditions = [
      eq(locations.orgId, session.orgId),
      eq(inventoryMovements.type, "received"),
      isNotNull(inventoryMovements.costCents),
      gte(inventoryMovements.createdAt, rangeStart),
    ];
    if (locationId)
      purchaseConditions.push(eq(inventoryMovements.locationId, locationId));
    const wastageConditions = [
      eq(locations.orgId, session.orgId),
      eq(inventoryMovements.type, "wasted"),
      gte(inventoryMovements.createdAt, rangeStart),
    ];
    if (locationId)
      wastageConditions.push(eq(inventoryMovements.locationId, locationId));

    const [
      revenueRows,
      manualExpenseRows,
      purchaseRows,
      wasteRows,
      allReceiptsForCosting,
    ] = await Promise.all([
      db
        .select({
          year: sql<number>`extract(year from ${ledgerEntries.createdAt})::int`,
          month: sql<number>`extract(month from ${ledgerEntries.createdAt})::int`,
          total: sql<number>`sum(${ledgerEntries.amountCents})::int`,
        })
        .from(ledgerEntries)
        .where(and(...revenueConditions))
        .groupBy(
          sql`extract(year from ${ledgerEntries.createdAt})`,
          sql`extract(month from ${ledgerEntries.createdAt})`,
        ),
      db
        .select({
          year: sql<number>`extract(year from ${expenses.expenseDate})::int`,
          month: sql<number>`extract(month from ${expenses.expenseDate})::int`,
          total: sql<number>`sum(${expenses.amountCents})::int`,
        })
        .from(expenses)
        .where(and(...manualExpenseConditions))
        .groupBy(
          sql`extract(year from ${expenses.expenseDate})`,
          sql`extract(month from ${expenses.expenseDate})`,
        ),
      db
        .select({
          year: sql<number>`extract(year from ${inventoryMovements.createdAt})::int`,
          month: sql<number>`extract(month from ${inventoryMovements.createdAt})::int`,
          total: sql<number>`sum(${inventoryMovements.costCents})::int`,
        })
        .from(inventoryMovements)
        .innerJoin(locations, eq(inventoryMovements.locationId, locations.id))
        .where(and(...purchaseConditions))
        .groupBy(
          sql`extract(year from ${inventoryMovements.createdAt})`,
          sql`extract(month from ${inventoryMovements.createdAt})`,
        ),
      db
        .select({
          itemId: inventoryMovements.itemId,
          quantity: inventoryMovements.quantity,
          createdAt: inventoryMovements.createdAt,
        })
        .from(inventoryMovements)
        .innerJoin(locations, eq(inventoryMovements.locationId, locations.id))
        .where(and(...wastageConditions)),
      db
        .select({
          itemId: inventoryMovements.itemId,
          costCents: inventoryMovements.costCents,
          quantity: inventoryMovements.quantity,
          createdAt: inventoryMovements.createdAt,
        })
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.type, "received"),
            isNotNull(inventoryMovements.costCents),
          ),
        )
        .orderBy(inventoryMovements.createdAt),
    ]);

    const wastageByKey = new Map<string, number>();
    for (const waste of wasteRows) {
      const priorReceipts = allReceiptsForCosting.filter(
        (r) => r.itemId === waste.itemId && r.createdAt <= waste.createdAt,
      );
      const lastReceipt = priorReceipts[priorReceipts.length - 1];
      if (!lastReceipt || !lastReceipt.costCents) continue; // no cost basis known yet - genuinely 0 for this event, honestly

      const costPerUnit = lastReceipt.costCents / lastReceipt.quantity;
      const estimatedCost = Math.round(costPerUnit * Math.abs(waste.quantity));

      const key = `${waste.createdAt.getFullYear()}-${waste.createdAt.getMonth() + 1}`;
      wastageByKey.set(key, (wastageByKey.get(key) ?? 0) + estimatedCost);
    }
    const revByKey = new Map(
      revenueRows.map((r) => [`${r.year}-${r.month}`, r.total]),
    );
    const manualByKey = new Map(
      manualExpenseRows.map((r) => [`${r.year}-${r.month}`, r.total]),
    );
    const purByKey = new Map(
      purchaseRows.map((r) => [`${r.year}-${r.month}`, r.total]),
    );

    const allRows: BreakdownRow[] = Array.from(
      { length: monthCount },
      (_, i) => {
        const d = new Date(
          rangeStart.getFullYear(),
          rangeStart.getMonth() + i,
          1,
        );
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`;

        const revenueCents = revByKey.get(key) ?? 0;
        const purchaseExpCents = purByKey.get(key) ?? 0;
        const wastageExpCents = wastageByKey.get(key) ?? 0;
        const manualExpCents = manualByKey.get(key) ?? 0;
        const totalExpenseCents =
          purchaseExpCents + wastageExpCents + manualExpCents;

        return {
          label: d.toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
          }),
          revenueCents,
          purchaseExpCents,
          wastageExpCents,
          manualExpCents,
          totalExpenseCents,
          netProfitCents: revenueCents - totalExpenseCents,
        };
      },
    ).reverse(); // most recent month first, matching the screenshot

    const total = allRows.length;
    const paged = allRows.slice(offset, offset + BREAKDOWN_PAGE_SIZE);

    return {
      success: true,
      rows: paged,
      pagination: { total, limit: BREAKDOWN_PAGE_SIZE, offset },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the breakdown.",
      code: "SERVER_ERROR",
    };
  }
}


export type AllOwnerDashboardResult =
  | {
      success: true;
      data: {
        stats: OwnerDashboardStats;
        chart: OwnerDashboardChartPoint[];
        breakdown: { rows: BreakdownRow[]; pagination: { total: number; limit: number; offset: number } };
      };
    }
  | { success: false; error: string };

// Every panel on the owner dashboard, in ONE call - three genuinely
// independent queries, run concurrently rather than as three separate
// frontend requests. Same reasoning as every other getAll in this
// project (doctor dashboard, front-desk dashboard, financial analytics).
export async function getAllOwnerDashboard(
  range: AnalyticsRange,
  locationId?: string,
  breakdownOffset: number = 0
): Promise<AllOwnerDashboardResult> {
  try {
    await requireSession(); // fail fast, once, before running three queries for nothing

    const [statsResult, chartResult, breakdownResult] = await Promise.all([
      getOwnerDashboardStats(range, locationId),
      getRevenueVsExpense(range, locationId),
      getBreakdown(range, locationId, breakdownOffset),
    ]);

    const failures = [statsResult, chartResult, breakdownResult];
    const firstFailure = failures.find((r) => !r.success);
    if (firstFailure && !firstFailure.success) {
      return { success: false, error: firstFailure.error };
    }

    return {
      success: true,
      data: {
        stats: (statsResult as Extract<typeof statsResult, { success: true }>).stats,
        chart: (chartResult as Extract<typeof chartResult, { success: true }>).chart,
        breakdown: {
          rows: (breakdownResult as Extract<typeof breakdownResult, { success: true }>).rows,
          pagination: (breakdownResult as Extract<typeof breakdownResult, { success: true }>).pagination,
        },
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the owner dashboard." };
  }
}
