import { requireSession, SessionError } from "@/lib/auth/get-session";
import { checkOwnerOrManager, CommissionErrorCode } from "../controller";
import { appointments, commissionExperienceTiers, doctorCommissions, ledgerEntries, patients, providerProfiles, treatments, userLocationRoles, users } from "@/db/schema";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";

export type CommissionSummaryRow = {
  id: string;
  treatmentName: string;
  chargeAmountCents: number;
  commissionPercent: number;
  commissionAmountCents: number;
  earnedAt: Date;
};

export type MyCommissionsResult =
  | { success: true; totalEarnedCents: number; entries: CommissionSummaryRow[] }
  | { success: false; error: string; code: CommissionErrorCode };

export async function getMyCommissions(
  from?: string,
  to?: string,
): Promise<MyCommissionsResult> {
  try {
    const session = await requireSession();

    const conditions = [eq(doctorCommissions.doctorId, session.userId)];
    if (from) conditions.push(gte(doctorCommissions.createdAt, new Date(from)));
    if (to) conditions.push(lte(doctorCommissions.createdAt, new Date(to)));

    const rows = await db
      .select({
        id: doctorCommissions.id,
        treatmentName: treatments.name,
        chargeAmountCents: doctorCommissions.chargeAmountCents,
        commissionPercent: doctorCommissions.commissionPercent,
        commissionAmountCents: doctorCommissions.commissionAmountCents,
        earnedAt: doctorCommissions.createdAt,
      })
      .from(doctorCommissions)
      .innerJoin(treatments, eq(doctorCommissions.treatmentId, treatments.id))
      .where(and(...conditions))
      .orderBy(desc(doctorCommissions.createdAt));
    const totalEarnedCents = rows.reduce(
      (sum, r) => sum + r.commissionAmountCents,
      0,
    );

    return { success: true, totalEarnedCents, entries: rows };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading your commissions.",
      code: "SERVER_ERROR",
    };
  }
}

export type DoctorEarningsRow = { doctorId: string; doctorName: string; totalEarnedCents: number; entryCount: number };

export type AllDoctorCommissionsResult =
  | { success: true; doctors: DoctorEarningsRow[] }
  | { success: false; error: string; code: CommissionErrorCode };

export async function getAllDoctorCommissions(
  from?: string,
  to?: string,
  locationId?: string
): Promise<AllDoctorCommissionsResult> {
  try {
    const session = await requireSession();

    if (!(await checkOwnerOrManager(session.userId))) {
      return { success: false, error: "Only an owner or manager can view all doctor commissions.", code: "FORBIDDEN" };
    }

    // ADDED - narrows which doctors even appear in the list, based on
    // WHERE they're clinically assigned, not just which org they belong to.
    const userConditions = [eq(users.orgId, session.orgId), eq(userLocationRoles.role, "clinical")];
    if (locationId) userConditions.push(eq(userLocationRoles.locationId, locationId));

    const rows = await db
      .select({
        doctorId: users.id,
        doctorName: users.name,
        totalEarnedCents: sql<number>`coalesce(sum(${doctorCommissions.commissionAmountCents}), 0)::int`,
        entryCount: sql<number>`count(${doctorCommissions.id})::int`,
      })
      .from(users)
      .innerJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
      .leftJoin(
        doctorCommissions,
        and(
          eq(doctorCommissions.doctorId, users.id),
          from ? gte(doctorCommissions.createdAt, new Date(from)) : undefined,
          to ? lte(doctorCommissions.createdAt, new Date(to)) : undefined
        )
      )
      .where(and(...userConditions))
      .groupBy(users.id, users.name)
      .orderBy(sql`coalesce(sum(${doctorCommissions.commissionAmountCents}), 0) desc`);

    return { success: true, doctors: rows };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading doctor commissions.", code: "SERVER_ERROR" };
  }
}

export type MissingCommissionRow = {
  ledgerEntryId: string;
  appointmentId: string;
  doctorId: string;
  doctorName: string;
  treatmentId: string;
  treatmentName: string;
  chargeAmountCents: number;
  settledAt: Date;
  reason: "no_matching_tier" | "no_rate_configured";
};

export type MissingCommissionsResult =
  | { success: true; gaps: MissingCommissionRow[] }
  | { success: false; error: string; code: CommissionErrorCode };

// Finds every SETTLED charge, tied to a real appointment, where no
// commission was ever recorded - and explains WHY, so an owner can
// actually fix the gap (add a tier, add a rate) rather than just knowing
// something's missing without knowing what to do about it.
export async function getMissingCommissions(locationId?: string): Promise<MissingCommissionsResult> {
  try {
    const session = await requireSession();

    if (!(await checkOwnerOrManager(session.userId))) {
      return { success: false, error: "Only an owner or manager can view commission gaps.", code: "FORBIDDEN" };
    }

    const conditions = [
      eq(patients.orgId, session.orgId),
      eq(ledgerEntries.type, "charge"),
      eq(ledgerEntries.status, "settled"),
      isNotNull(ledgerEntries.appointmentId),
    ];
    if (locationId) conditions.push(eq(appointments.locationId, locationId));

    // Every settled charge tied to a real appointment, LEFT joined
    // against doctorCommissions - a charge with no matching commission
    // row shows up here with commissionId: null, which is exactly what
    // identifies the gap.
    const rows = await db
      .select({
        ledgerEntryId: ledgerEntries.id,
        appointmentId: appointments.id,
        doctorId: users.id,
        doctorName: users.name,
        treatmentId: treatments.id,
        treatmentName: treatments.name,
        chargeAmountCents: ledgerEntries.amountCents,
        settledAt: ledgerEntries.createdAt,
        commissionId: doctorCommissions.id,
        yearsOfExperience: providerProfiles.yearsOfExperience,
      })
      .from(ledgerEntries)
      .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
      .innerJoin(appointments, eq(ledgerEntries.appointmentId, appointments.id))
      .innerJoin(users, eq(appointments.providerId, users.id))
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
      .leftJoin(doctorCommissions, eq(doctorCommissions.ledgerEntryId, ledgerEntries.id))
      .where(and(...conditions));

    const gapRows = rows.filter((r) => r.commissionId === null);
    if (gapRows.length === 0) {
      return { success: true, gaps: [] };
    }

    // Fetch tiers/rates once, up front - not per-row - same "avoid N+1"
    // discipline used everywhere else in this project.
    const tiers = await db.query.commissionExperienceTiers.findMany({ where: eq(commissionExperienceTiers.orgId, session.orgId) });
    const rates = await db.query.treatmentCommissionRates.findMany();

    const gaps: MissingCommissionRow[] = gapRows.map((row) => {
      const years = row.yearsOfExperience ?? 0;
      const matchingTier = tiers.find((t) => years >= t.minYears && (t.maxYears === null || years <= t.maxYears));

      const reason: MissingCommissionRow["reason"] = !matchingTier
        ? "no_matching_tier"
        : !rates.some((r) => r.treatmentId === row.treatmentId && r.tierId === matchingTier.id)
        ? "no_rate_configured"
        : "no_rate_configured"; // shouldn't reach here if recordDoctorCommission ran correctly, defaults safely

      return {
        ledgerEntryId: row.ledgerEntryId,
        appointmentId: row.appointmentId,
        doctorId: row.doctorId,
        doctorName: row.doctorName,
        treatmentId: row.treatmentId,
        treatmentName: row.treatmentName,
        chargeAmountCents: row.chargeAmountCents,
        settledAt: row.settledAt,
        reason,
      };
    });

    return { success: true, gaps };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading commission gaps.", code: "SERVER_ERROR" };
  }
}