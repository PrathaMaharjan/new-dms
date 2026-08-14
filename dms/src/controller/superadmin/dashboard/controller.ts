import { sql, and, gte, lte, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { requireSuperAdminSession, SuperAdminSessionError } from "@/lib/auth/supperadmin-session";

export type SuperAdminDashboardErrorCode = "UNAUTHORIZED" | "SERVER_ERROR";

// ---------- Stat cards ----------

export type SuperAdminStatsResult =
  | { success: true; stats: { totalOrganizations: number; activeOrgs: number } }
  | { success: false; error: string; code: SuperAdminDashboardErrorCode };

export async function getSuperAdminStats(): Promise<SuperAdminStatsResult> {
  try {
    await requireSuperAdminSession();


    // Platform-wide, no orgId filter anywhere - this is the one
    // legitimate place in the whole project where counting across
    // EVERY organization at once is exactly the intended behavior.
    const [totalResult, activeResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(organizations),
      db.select({ count: sql<number>`count(*)::int` }).from(organizations).where(eq(organizations.status, "active")),
    ]);

    return {
      success: true,
      stats: {
        totalOrganizations: totalResult[0]?.count ?? 0,
        activeOrgs: activeResult[0]?.count ?? 0,
      },
    };
  } catch (err) {
    if (err instanceof SuperAdminSessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading dashboard stats.", code: "SERVER_ERROR" };
  }
}

// ---------- Organization Growth chart - full year, Jan..Dec ----------

export type OrgGrowthResult =
  | { success: true; growth: { label: string; count: number }[] }
  | { success: false; error: string; code: SuperAdminDashboardErrorCode };

// One specific year at a time, matching the "< 2025 >" selector in the
// screenshot - genuinely different shape from getNewPatientTrend's
// rolling 7d/1m/6m/1y ranges, since this is anchored to a calendar year
// a superadmin can page backward/forward through.
export async function getOrganizationGrowth(year: number): Promise<OrgGrowthResult> {
  try {
    await requireSuperAdminSession();

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const rows = await db
      .select({
        month: sql<number>`extract(month from ${organizations.createdAt})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(organizations)
      .where(and(gte(organizations.createdAt, yearStart), lte(organizations.createdAt, yearEnd)))
      .groupBy(sql`extract(month from ${organizations.createdAt})`);

    // Full 12-month scaffold, Jan through Dec - a month with zero new
    // orgs still shows a real 0, matching the same fix applied to every
    // other trend chart earlier this project.
    const countsByMonth = new Map(rows.map((r) => [r.month, r.count]));
    const growth = Array.from({ length: 12 }, (_, i) => ({
      label: new Date(2000, i, 1).toLocaleDateString("en-US", { month: "short" }),
      count: countsByMonth.get(i + 1) ?? 0,
    }));

    return { success: true, growth };
  } catch (err) {
    if (err instanceof SuperAdminSessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading organization growth.", code: "SERVER_ERROR" };
  }
}