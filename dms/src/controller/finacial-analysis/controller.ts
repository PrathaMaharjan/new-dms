import { db } from "@/db";
import {
  expenseCategories,
  expenses,
  inventoryMovements,
  ledgerEntries,
  locations,
  organizations,
  patients,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";

export type FinancialAnalyticsErrorCode = "UNAUTHORIZED" | "SERVER_ERROR";

export type AnalyticsRange = "6m" | "1y" | "all";

export type FinancialSummaryResult =
  | {
      success: true;
      summary: {
        totalCostCents: number;
        totalRevenueCents: number;
        netPositionCents: number;
        costRatioPercent: number;
      };
    }
  | { success: false; error: string; code: FinancialAnalyticsErrorCode };

function getRangeStart(range: AnalyticsRange): Date | null {
  const now = new Date();
  if (range === "6m")
    return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  if (range === "1y")
    return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  return null;
}

export async function getFinancialSummary(
  range: AnalyticsRange,
  locationId?: string,
): Promise<FinancialSummaryResult> {
  try {
    const session = await requireSession();
    const rangeStart = getRangeStart(range);
    // ---------- Revenue: charge-type ledger entries ----------
    const revenueConditions = [
      eq(patients.orgId, session.orgId),
      eq(ledgerEntries.type, "charge"),
    ];
    if (locationId) revenueConditions.push(eq(patients.locationId, locationId));
    if (rangeStart)
      revenueConditions.push(gte(ledgerEntries.createdAt, rangeStart));

    // ---------- Cost, part 1: real expenses ----------
    const expenseConditions = [
      eq(expenses.orgId, session.orgId),
      isNull(expenses.deletedAt),
    ];
    if (locationId) expenseConditions.push(eq(expenses.locationId, locationId));
    if (rangeStart)
      expenseConditions.push(
        sql`${expenses.expenseDate} >= ${rangeStart.toISOString().slice(0, 10)}`,
      );

    // ---------- Cost, part 2: inventory purchases with a real cost ----------
    const purchaseConditions = [
      eq(locations.orgId, session.orgId),
      eq(inventoryMovements.type, "received"),
      isNotNull(inventoryMovements.costCents),
    ];
    if (locationId)
      purchaseConditions.push(eq(inventoryMovements.locationId, locationId));
    if (rangeStart)
      purchaseConditions.push(gte(inventoryMovements.createdAt, rangeStart));

    const [revenueResult, expenseResult, purchaseResult] = await Promise.all([
      db
        .select({
          total: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::int`,
        })
        .from(ledgerEntries)
        .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
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
    const totalRevenueCents = revenueResult[0]?.total ?? 0;
    const totalCostCents =
      (expenseResult[0]?.total ?? 0) + (purchaseResult[0]?.total ?? 0);
    const netPositionCents = totalRevenueCents - totalCostCents;

    // Guard against division by zero for a brand-new org with no revenue
    // yet - 0% is the honest answer, not NaN, same pattern used for
    // collectionRatePercent in getAdminBillingStats.
    const costRatioPercent =
      totalRevenueCents > 0
        ? Math.round((totalCostCents / totalRevenueCents) * 1000) / 10
        : 0;

    return {
      success: true,
      summary: {
        totalCostCents,
        totalRevenueCents,
        netPositionCents,
        costRatioPercent,
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the financial summary.",
      code: "SERVER_ERROR",
    };
  }
}

// revenuse caost chart data

export type CostRevenueTrendResult =
  | {
      success: true;
      trend: { label: string; costCents: number; revenueCents: number }[];
    }
  | { success: false; error: string; code: FinancialAnalyticsErrorCode };

export async function getCostRevenueTrend(
  range: AnalyticsRange,
  locationId?: string,
): Promise<CostRevenueTrendResult> {
  try {
    const session = await requireSession();
    console.log("range : ", range);

    if (range === "6m")
      return getMonthlyCostRevenue(session.orgId, 6, locationId);
    if (range === "1y")
      return getMonthlyCostRevenue(session.orgId, 12, locationId);
    return getYearlyCostRevenue(session.orgId, locationId);
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the cost/revenue trend.",
      code: "SERVER_ERROR",
    };
  }
}

async function getMonthlyCostRevenue(
  orgId: string,
  monthCount: number,
  locationId?: string,
): Promise<CostRevenueTrendResult> {
  const now = new Date();
  const rangeStart = new Date(
    now.getFullYear(),
    now.getMonth() - (monthCount - 1),
    1,
  );

  const revenueConditions = [
    eq(patients.orgId, orgId),
    eq(ledgerEntries.type, "charge"),
    gte(ledgerEntries.createdAt, rangeStart),
  ];
  if (locationId) revenueConditions.push(eq(patients.locationId, locationId));

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
  const [revenueRows, expenseRows, purchaseRows] = await Promise.all([
    db
      .select({
        year: sql<number>`extract(year from ${ledgerEntries.createdAt})::int`,
        month: sql<number>`extract(month from ${ledgerEntries.createdAt})::int`,
        total: sql<number>`sum(${ledgerEntries.amountCents})::int`,
      })
      .from(ledgerEntries)
      .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
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

  const revenueByKey = new Map(
    revenueRows.map((r) => [`${r.year}-${r.month}`, r.total]),
  );
  const expenseByKey = new Map(
    expenseRows.map((r) => [`${r.year}-${r.month}`, r.total]),
  );
  const purchaseByKey = new Map(
    purchaseRows.map((r) => [`${r.year}-${r.month}`, r.total]),
  );

  const trend = Array.from({ length: monthCount }, (_, i) => {
    const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    return {
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      costCents: (expenseByKey.get(key) ?? 0) + (purchaseByKey.get(key) ?? 0),
      revenueCents: revenueByKey.get(key) ?? 0,
    };
  });

  return { success: true, trend };
}

// ---------- overall - one point per calendar year, since the org was created ----------

async function getYearlyCostRevenue(
  orgId: string,
  locationId?: string,
): Promise<CostRevenueTrendResult> {
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

  const [revenueRows, expenseRows, purchaseRows] = await Promise.all([
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

  const revenueByYear = new Map(revenueRows.map((r) => [r.year, r.total]));
  const expenseByYear = new Map(expenseRows.map((r) => [r.year, r.total]));
  const purchaseByYear = new Map(purchaseRows.map((r) => [r.year, r.total]));

  const trend = [];
  for (let year = startYear; year <= currentYear; year++) {
    trend.push({
      label: String(year),
      costCents:
        (expenseByYear.get(year) ?? 0) + (purchaseByYear.get(year) ?? 0),
      revenueCents: revenueByYear.get(year) ?? 0,
    });
  }

  return { success: true, trend };
}

// cost by category ==========
export type CostByCategoryResult =
  | { success: true; breakdown: { categoryName: string; costCents: number }[] }
  | { success: false; error: string; code: FinancialAnalyticsErrorCode };

export async function getCostByCategory(
  locationId?: string,
): Promise<CostByCategoryResult> {
  try {
    const session = await requireSession();

    const expenseConditions = [
      eq(expenses.orgId, session.orgId),
      isNull(expenses.deletedAt),
    ];
    if (locationId) expenseConditions.push(eq(expenses.locationId, locationId));

    const purchaseConditions = [
      eq(locations.orgId, session.orgId),
      eq(inventoryMovements.type, "received"),
      isNotNull(inventoryMovements.costCents),
    ];
    if (locationId)
      purchaseConditions.push(eq(inventoryMovements.locationId, locationId));
    const [expenseRows, purchaseTotal] = await Promise.all([
      db
        .select({
          categoryName: expenseCategories.name,
          total: sql<number>`sum(${expenses.amountCents})::int`,
        })
        .from(expenses)
        .innerJoin(
          expenseCategories,
          eq(expenses.categoryId, expenseCategories.id),
        )
        .where(and(...expenseConditions))
        .groupBy(expenseCategories.name),
      db
        .select({
          total: sql<number>`coalesce(sum(${inventoryMovements.costCents}), 0)::int`,
        })
        .from(inventoryMovements)
        .innerJoin(locations, eq(inventoryMovements.locationId, locations.id))
        .where(and(...purchaseConditions)),
    ]);

    const breakdown = [
      ...expenseRows.map((e) => ({
        categoryName: e.categoryName,
        costCents: e.total,
      })),
    ];
    if (purchaseTotal[0]?.total > 0) {
      breakdown.push({
        categoryName: "Inventory",
        costCents: purchaseTotal[0].total,
      });
    }

    return { success: true, breakdown };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading cost by category.",
      code: "SERVER_ERROR",
    };
  }
}

// Cost Breakdown by Category

export type CostBreakdownRow = {
  categoryName: string;
  costCents: number;
  percentOfMax: number; // 0-100, relative to the largest category - drives each bar's fill width
};

export type CostBreakdownResult =
  | { success: true; breakdown: CostBreakdownRow[] }
  | { success: false; error: string; code: FinancialAnalyticsErrorCode };

export async function getCostBreakdown(
  range: AnalyticsRange,
  locationId?: string,
): Promise<CostBreakdownResult> {
  try {
    const session = await requireSession();
    const rangeStart = getRangeStart(range);

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
    const [expenseRows, purchaseTotal] = await Promise.all([
      db
        .select({
          categoryName: expenseCategories.name,
          total: sql<number>`sum(${expenses.amountCents})::int`,
        })
        .from(expenses)
        .innerJoin(
          expenseCategories,
          eq(expenses.categoryId, expenseCategories.id),
        )
        .where(and(...expenseConditions))
        .groupBy(expenseCategories.name),
      db
        .select({
          total: sql<number>`coalesce(sum(${inventoryMovements.costCents}), 0)::int`,
        })
        .from(inventoryMovements)
        .innerJoin(locations, eq(inventoryMovements.locationId, locations.id))
        .where(and(...purchaseConditions)),
    ]);

    const raw = [
      ...expenseRows.map((e) => ({
        categoryName: e.categoryName,
        costCents: e.total,
      })),
    ];
    if (purchaseTotal[0]?.total > 0) {
      raw.push({
        categoryName: "Inventory",
        costCents: purchaseTotal[0].total,
      });
    }
    const maxCents =
      raw.length > 0 ? Math.max(...raw.map((r) => r.costCents)) : 0;
    const breakdown = raw
      .map((r) => ({
        ...r,
        percentOfMax:
          maxCents > 0 ? Math.round((r.costCents / maxCents) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.costCents - a.costCents); // largest first, matching Inventory leading in the screenshot

    return { success: true, breakdown };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading cost breakdown.",
      code: "SERVER_ERROR",
    };
  }
}

// get monthly breakdown ---------------------------
export type MonthlyBreakdownRow = {
  label: string; // "Aug 26"
  revenueCents: number;
  categoryCosts: Record<string, number>; // e.g. { "Inventory": 92982, "Staff & Lab": 110028, "Utilities": 23424 }
  totalCostCents: number;
  netCents: number;
};

export type MonthlyBreakdownResult =
  | { success: true; rows: MonthlyBreakdownRow[]; pagination: { total: number; limit: number; offset: number } }
  | { success: false; error: string; code: FinancialAnalyticsErrorCode };

const MONTHLY_BREAKDOWN_PAGE_SIZE = 6;

export async function getMonthlyBreakdown(
  monthCount: number,
  locationId: string | undefined,
  offset: number = 0
): Promise<MonthlyBreakdownResult> {
  try {
    const session = await requireSession();

    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1);

    const revenueConditions = [eq(patients.orgId, session.orgId), eq(ledgerEntries.type, "charge"), gte(ledgerEntries.createdAt, rangeStart)];
    if (locationId) revenueConditions.push(eq(patients.locationId, locationId));

    const expenseConditions = [eq(expenses.orgId, session.orgId), isNull(expenses.deletedAt), sql`${expenses.expenseDate} >= ${rangeStart.toISOString().slice(0, 10)}`];
    if (locationId) expenseConditions.push(eq(expenses.locationId, locationId));

    const purchaseConditions = [eq(locations.orgId, session.orgId), eq(inventoryMovements.type, "received"), isNotNull(inventoryMovements.costCents), gte(inventoryMovements.createdAt, rangeStart)];
    if (locationId) purchaseConditions.push(eq(inventoryMovements.locationId, locationId));
        const [revenueRows, expenseRows, purchaseRows] = await Promise.all([
      db
        .select({
          year: sql<number>`extract(year from ${ledgerEntries.createdAt})::int`,
          month: sql<number>`extract(month from ${ledgerEntries.createdAt})::int`,
          total: sql<number>`sum(${ledgerEntries.amountCents})::int`,
        })
        .from(ledgerEntries)
        .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
        .where(and(...revenueConditions))
        .groupBy(sql`extract(year from ${ledgerEntries.createdAt})`, sql`extract(month from ${ledgerEntries.createdAt})`),
      // Cross-tab: grouped by month AND category together, not just one
      // total per category (getCostByCategory) or one total per month
      // (getCostRevenueTrend) - this is the genuinely new query shape.
      db
        .select({
          year: sql<number>`extract(year from ${expenses.expenseDate})::int`,
          month: sql<number>`extract(month from ${expenses.expenseDate})::int`,
          categoryName: expenseCategories.name,
          total: sql<number>`sum(${expenses.amountCents})::int`,
        })
        .from(expenses)
        .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
        .where(and(...expenseConditions))
        .groupBy(sql`extract(year from ${expenses.expenseDate})`, sql`extract(month from ${expenses.expenseDate})`, expenseCategories.name),
      db
        .select({
          year: sql<number>`extract(year from ${inventoryMovements.createdAt})::int`,
          month: sql<number>`extract(month from ${inventoryMovements.createdAt})::int`,
          total: sql<number>`sum(${inventoryMovements.costCents})::int`,
        })
        .from(inventoryMovements)
        .innerJoin(locations, eq(inventoryMovements.locationId, locations.id))
        .where(and(...purchaseConditions))
        .groupBy(sql`extract(year from ${inventoryMovements.createdAt})`, sql`extract(month from ${inventoryMovements.createdAt})`),
    ]);

    const revenueByKey = new Map(revenueRows.map((r) => [`${r.year}-${r.month}`, r.total]));
    const purchaseByKey = new Map(purchaseRows.map((r) => [`${r.year}-${r.month}`, r.total]));

    // Group expense rows by month key first, so each month can hold
    // multiple category totals - a nested map, not a flat one.
    const expensesByMonth = new Map<string, Record<string, number>>();
    for (const row of expenseRows) {
      const key = `${row.year}-${row.month}`;
      const existing = expensesByMonth.get(key) ?? {};
      existing[row.categoryName] = row.total;
      expensesByMonth.set(key, existing);
    }

    const allRows: MonthlyBreakdownRow[] = Array.from({ length: monthCount }, (_, i) => {
      const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;

      const categoryCosts: Record<string, number> = { ...(expensesByMonth.get(key) ?? {}) };
      const inventoryCost = purchaseByKey.get(key) ?? 0;
      if (inventoryCost > 0) categoryCosts["Inventory"] = inventoryCost;

      const totalCostCents = Object.values(categoryCosts).reduce((sum, v) => sum + v, 0);
      const revenueCents = revenueByKey.get(key) ?? 0;

      return {
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        revenueCents,
        categoryCosts,
        totalCostCents,
        netCents: revenueCents - totalCostCents,
      };
    }).reverse(); // most recent month first, matching the screenshot's Aug 26 -> Mar 26 order

    const total = allRows.length;
    const paged = allRows.slice(offset, offset + MONTHLY_BREAKDOWN_PAGE_SIZE);

    return { success: true, rows: paged, pagination: { total, limit: MONTHLY_BREAKDOWN_PAGE_SIZE, offset } };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the monthly breakdown.", code: "SERVER_ERROR" };
  }
}


export type AllFinancialAnalyticsResult =
  | {
      success: true;
      data: {
        summary: {
          totalCostCents: number;
          totalRevenueCents: number;
          netPositionCents: number;
          costRatioPercent: number;
        };
        costRevenueTrend: { label: string; costCents: number; revenueCents: number }[];
        costBreakdown: CostBreakdownRow[];
        monthlyBreakdown: {
          rows: MonthlyBreakdownRow[];
          pagination: { total: number; limit: number; offset: number };
        };
      };
    }
  | { success: false; error: string };

  export async function getAllFinancialAnalytics(
  range: AnalyticsRange,
  locationId?: string,
  monthlyBreakdownOffset: number = 0
): Promise<AllFinancialAnalyticsResult> {
  try {
    await requireSession();

    const monthCountForBreakdown = range === "6m" ? 6 : 12; // "all" still shows a 12-month table, same as "1y"

    const [summaryResult, trendResult, breakdownResult, monthlyResult] = await Promise.all([
      getFinancialSummary(range, locationId),
      getCostRevenueTrend(range, locationId),
      getCostBreakdown(range, locationId),
      getMonthlyBreakdown(monthCountForBreakdown, locationId, monthlyBreakdownOffset),
    ]);

    const failures = [summaryResult, trendResult, breakdownResult, monthlyResult];
    const firstFailure = failures.find((r) => !r.success);
    if (firstFailure && !firstFailure.success) {
      return { success: false, error: firstFailure.error };
    }
        return {
      success: true,
      data: {
        summary: (summaryResult as Extract<typeof summaryResult, { success: true }>).summary,
        costRevenueTrend: (trendResult as Extract<typeof trendResult, { success: true }>).trend,
        costBreakdown: (breakdownResult as Extract<typeof breakdownResult, { success: true }>).breakdown,
        monthlyBreakdown: {
          rows: (monthlyResult as Extract<typeof monthlyResult, { success: true }>).rows,
          pagination: (monthlyResult as Extract<typeof monthlyResult, { success: true }>).pagination,
        },
      },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading financial analytics." };
  }
}
