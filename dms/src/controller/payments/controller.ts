import { db } from "@/db";
import {
  appointments,
  commissionExperienceTiers,
  doctorCommissions,
  ledgerEntries,
  locations,
  patients,
  providerProfiles,
  treatmentCommissionRates,
  treatments,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { addLedgerEntrySchema } from "@/lib/validators/billing";
import { and, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function recordDoctorCommission(
  tx: Transaction,
  charge: { id: string; appointmentId: string; amountCents: number },
) {
  const appointment = await tx.query.appointments.findFirst({
    where: eq(appointments.id, charge.appointmentId),
  });
  if (!appointment) {
    console.log(`[commission] SKIPPED - appointment ${charge.appointmentId} not found for charge ${charge.id}`);
    return;
  }

  // ADDED - need the org this appointment actually belongs to, since
  // tiers/rates are scoped per-org and appointments have no orgId
  // column directly (same reasoning used throughout this project -
  // reach org via locations).
  const location = await tx.query.locations.findFirst({
    where: eq(locations.id, appointment.locationId),
  });
  if (!location) {
    console.log(`[commission] SKIPPED - location not found for appointment ${appointment.id}`);
    return;
  }

  const doctorProfile = await tx.query.providerProfiles.findFirst({
    where: eq(providerProfiles.userId, appointment.providerId),
  });
  const years = doctorProfile?.yearsOfExperience ?? 0;

  const tier = await tx.query.commissionExperienceTiers.findFirst({
    where: and(
      eq(commissionExperienceTiers.orgId, location.orgId), // ADDED - the actual missing filter
      lte(commissionExperienceTiers.minYears, years),
      or(
        isNull(commissionExperienceTiers.maxYears),
        gte(commissionExperienceTiers.maxYears, years),
      ),
    ),
  });
  if (!tier) {
    console.log(
      `[commission] SKIPPED - no matching experience tier for doctor ${appointment.providerId} (${years} years) in org ${location.orgId}. Charge ${charge.id}, appointment ${appointment.id}.`
    );
    return;
  }

  const rate = await tx.query.treatmentCommissionRates.findFirst({
    where: and(
      eq(treatmentCommissionRates.treatmentId, appointment.treatmentId),
      eq(treatmentCommissionRates.tierId, tier.id),
    ),
  });
  if (!rate) {
    console.log(
      `[commission] SKIPPED - no rate configured for treatment ${appointment.treatmentId} + tier ${tier.id} ("${tier.name}"). Charge ${charge.id}, appointment ${appointment.id}.`
    );
    return;
  }

  const commissionAmountCents = Math.round((charge.amountCents * rate.commissionPercent) / 100);

  await tx.insert(doctorCommissions).values({
    doctorId: appointment.providerId,
    appointmentId: appointment.id,
    ledgerEntryId: charge.id,
    treatmentId: appointment.treatmentId,
    tierId: tier.id,
    commissionPercent: rate.commissionPercent,
    chargeAmountCents: charge.amountCents,
    commissionAmountCents,
  });

  console.log(
    `[commission] RECORDED - doctor ${appointment.providerId} earned ${commissionAmountCents} cents (${rate.commissionPercent}%) on charge ${charge.id}.`
  );
}

async function reconcilePatientCharges(tx: Transaction, patientId: string) {
  const allEntries = await tx
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.patientId, patientId))
    .orderBy(ledgerEntries.createdAt);

  const charges = allEntries.filter((e) => e.type === "charge");
  const totalCredit = allEntries
    .filter((e) => e.type === "payment" || e.type === "adjustment")
    .reduce((sum, e) => sum + Math.abs(e.amountCents), 0);

  let remainingCredit = totalCredit;
  for (const charge of charges) {
    const newStatus = remainingCredit >= charge.amountCents ? "settled" : "due";

    if (newStatus === "settled" && charge.status !== "settled") {
      if (charge.appointmentId) {
        await recordDoctorCommission(tx, {
          id: charge.id,
          appointmentId: charge.appointmentId,
          amountCents: charge.amountCents,
        });
      } else {
        console.log(`[commission] SKIPPED - charge ${charge.id} settled with no appointmentId attached.`);
      }
    }

    if (newStatus === "settled") remainingCredit -= charge.amountCents;
    await tx.update(ledgerEntries).set({ status: newStatus }).where(eq(ledgerEntries.id, charge.id));
  }
}

export type LedgerErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "NOT_FOUND"
  | "SERVER_ERROR";

export type AddLedgerEntryResult =
  | { success: true; entryId: string; newBalanceCents: number }
  | { success: false; error: string; code: LedgerErrorCode };

export async function addLedgerEntry(
  input: unknown,
): Promise<AddLedgerEntryResult> {
  try {
    const session = await requireSession();

    const parsed = addLedgerEntrySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;

    if (data.type === "payment" && !data.paymentMethod) {
      return {
        success: false,
        error: "Please select a payment method.",
        code: "VALIDATION",
      };
    }

    const patient = await db.query.patients.findFirst({
      where: and(
        eq(patients.id, data.patientId),
        eq(patients.orgId, session.orgId),
      ),
    });
    if (!patient) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }

    if (data.appointmentId) {
      const appointment = await db.query.appointments.findFirst({
        where: and(
          eq(appointments.id, data.appointmentId),
          eq(appointments.patientId, data.patientId),
        ),
      });
      if (!appointment) {
        return {
          success: false,
          error: "Appointment not found for this patient.",
          code: "NOT_FOUND",
        };
      }
    }

    const signedAmount =
      data.type === "charge" ? data.amountCents : -data.amountCents;
      console.log(session.orgId)

    const entryId = await db.transaction(async (tx) => {
      const [entry] = await tx
        .insert(ledgerEntries)
        .values({
          orgId: session.orgId,
          locationId: data.locationId,
          patientId: data.patientId,
          appointmentId: data.appointmentId,
          type: data.type,
          amountCents: signedAmount,
          paymentMethod: data.type === "payment" ? data.paymentMethod : null,
       
          status: data.type === "charge" ? "due" : "settled",
        })
        .returning();

      await reconcilePatientCharges(tx, data.patientId);

      return entry.id;
    });

    const [balanceResult] = await db
      .select({
        balance: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::int`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.patientId, data.patientId));

    return { success: true, entryId, newBalanceCents: balanceResult.balance };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong adding the ledger entry.",
      code: "SERVER_ERROR",
    };
  }
}

// get patent ledger history
export type LedgerHistoryResult =
  | {
      success: true;
      summary: {
        totalChargedCents: number;
        totalPaidCents: number;
        balanceDueCents: number;
      };
      entries: {
        id: string;
        type: string;
        amountCents: number;
        paymentMethod: string | null;
        // note: string | null;
        appointmentTreatmentName: string | null;
        createdAt: Date;
      }[];
    }
  | { success: false; error: string; code: LedgerErrorCode };

export async function getLedgerHistory(
  patientId: string,
): Promise<LedgerHistoryResult> {
  try {
    const session = await requireSession();

    const patient = await db.query.patients.findFirst({
      where: and(eq(patients.id, patientId), eq(patients.orgId, session.orgId)),
    });
    if (!patient) {
      return { success: false, error: "Patient not found.", code: "NOT_FOUND" };
    }

    // FIXED: coalesce() now wraps sum(...) filter (...) FIRST, guaranteeing
    // a real 0 before abs() ever runs - the original had abs() wrapping
    // the raw filtered sum directly, so abs(NULL) stayed NULL even after
    // the outer coalesce, which is what caused the 500.
    const [summaryResult, entries] = await Promise.all([
      db
        .select({
          totalChargedCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'charge'), 0)::int`,
          totalPaidCents: sql<number>`abs(coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'payment'), 0))::int`,
          balanceDueCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::int`,
        })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.patientId, patientId)),
      db
        .select({
          id: ledgerEntries.id,
          type: ledgerEntries.type,
          amountCents: ledgerEntries.amountCents,
          paymentMethod: ledgerEntries.paymentMethod,
          // note: ledgerEntries.note,
          appointmentTreatmentName: treatments.name,
          createdAt: ledgerEntries.createdAt,
        })
        .from(ledgerEntries)
        .leftJoin(
          appointments,
          eq(ledgerEntries.appointmentId, appointments.id),
        )
        .leftJoin(treatments, eq(appointments.treatmentId, treatments.id))
        .where(eq(ledgerEntries.patientId, patientId))
        .orderBy(desc(ledgerEntries.createdAt)),
    ]);

    // Defensive fallback - guarantees `summary` is always a real object,
    // never undefined, even if this patient somehow has zero entries and
    // the aggregate query returns an empty array instead of one zeroed row.
    const summary = summaryResult[0] ?? {
      totalChargedCents: 0,
      totalPaidCents: 0,
      balanceDueCents: 0,
    };

    return {
      success: true,
      summary,
      entries,
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading ledger history.",
      code: "SERVER_ERROR",
    };
  }
}

// get stats
export type BillingStatsErrorCode = "UNAUTHORIZED" | "SERVER_ERROR";

export type BillingStatsResult =
  | {
      success: true;
      stats: {
        totalChargedCents: number;
        totalCollectedCents: number;
        outstandingDuesCents: number;
        patientsWithDuesCount: number;
      };
    }
  | { success: false; error: string; code: BillingStatsErrorCode };

export async function getBillingStats(
  locationId: string,
): Promise<BillingStatsResult> {
  try {
    const session = await requireSession();

    const [orgTotals, perPatientBalances] = await Promise.all([
      db
        .select({
          totalChargedCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'charge'), 0)::int`,
          totalCollectedCents: sql<number>`abs(coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'payment'), 0))::int`,
        })
        .from(ledgerEntries)
        .innerJoin(patients, eq(ledgerEntries.patientId, patients.id))
        .where(
          and(
            eq(patients.orgId, session.orgId),
            or(eq(patients.locationId, locationId), isNull(patients.locationId)),
            isNull(patients.deletedAt),
          ),
        ),
      db
        .select({
          patientId: patients.id,
          balanceCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::int`,
        })
        .from(patients)
        .leftJoin(ledgerEntries, eq(ledgerEntries.patientId, patients.id))
        .where(
          and(
            eq(patients.orgId, session.orgId),
            or(eq(patients.locationId, locationId), isNull(patients.locationId)),
            isNull(patients.deletedAt),
          ),
        )
        .groupBy(patients.id),
    ]);

    const outstandingDuesCents = perPatientBalances.reduce(
      (sum, p) => sum + Math.max(p.balanceCents, 0),
      0,
    );
    const patientsWithDuesCount = perPatientBalances.filter(
      (p) => p.balanceCents > 0,
    ).length;

    return {
      success: true,
      stats: {
        totalChargedCents: orgTotals[0]?.totalChargedCents ?? 0,
        totalCollectedCents: orgTotals[0]?.totalCollectedCents ?? 0,
        outstandingDuesCents,
        patientsWithDuesCount,
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

export type BillingPatientsErrorCode = "UNAUTHORIZED" | "SERVER_ERROR";


export type BillingPatientRow = {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  lastActivity: Date | null;
  lastTreatmentName: string | null;
  lastTreatmentCostCents: number | null;
  chargedCents: number;
  paidCents: number;
  balanceCents: number;
  status: "due" | "settled";
};
export type BillingPatientsResult =
  | {
      success: true;
      patients: BillingPatientRow[];
      pagination: { total: number; limit: number; offset: number };
    }
  | { success: false; error: string; code: BillingPatientsErrorCode };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;


// const MAX_LIMIT = 100;

export async function getBillingPatients(
  locationId: string,
  options?: {
    search?: string;
    balanceFilter?: "all" | "due" | "settled";
    limit?: number;
    offset?: number;
  }
): Promise<BillingPatientsResult> {
  try {
    const session = await requireSession();

    const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(options?.offset ?? 0, 0);

    const conditions = [
      eq(patients.orgId, session.orgId),
      or(eq(patients.locationId, locationId), isNull(patients.locationId)),
      isNull(patients.deletedAt),
    ];
    if (options?.search) {
      conditions.push(
        sql`(${patients.firstName} || ' ' || ${patients.lastName} ilike ${"%" + options.search + "%"} or ${patients.phone} ilike ${"%" + options.search + "%"})`
      );
    }

    const rows = await db
      .select({
        patientId: patients.id,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        patientPhone: patients.phone,
        lastActivity: sql<Date | null>`max(${ledgerEntries.createdAt})`,
        chargedCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'charge'), 0)::int`,
        paidCents: sql<number>`abs(coalesce(sum(${ledgerEntries.amountCents}) filter (where ${ledgerEntries.type} = 'payment'), 0))::int`,
        balanceCents: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)::int`,
      })
      .from(patients)
      .leftJoin(ledgerEntries, eq(ledgerEntries.patientId, patients.id))
      .where(and(...conditions))
      .groupBy(patients.id, patients.firstName, patients.lastName, patients.phone);

    // CHANGED - completely bypasses ledger_entries.appointment_id (which
    // we've confirmed is empty for these charges). Instead, goes
    // directly from patient_id -> appointments -> treatments, picking
    // each patient's MOST RECENT real appointment. Worth being precise:
    // this is NOT "the treatment for this specific charge" - it's "this
    // patient's latest scheduled visit," which may have no actual
    // relationship to what they were billed for, since nothing links
    // the two. Shown regardless of whether that appointment ever had a
    // charge recorded against it at all.
    const patientIds = rows.map((r) => r.patientId);
    const lastAppointmentRows = patientIds.length
      ? await db
          .selectDistinctOn([appointments.patientId], {
            patientId: appointments.patientId,
            treatmentName: treatments.name,
            treatmentCostCents: treatments.priceCents,
          })
          .from(appointments)
          .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
          .where(and(inArray(appointments.patientId, patientIds), ne(appointments.status, "cancelled")))
          .orderBy(appointments.patientId, desc(appointments.startTime))
      : [];

    const treatmentByPatient = new Map(
      lastAppointmentRows.map((r) => [r.patientId, { name: r.treatmentName, costCents: r.treatmentCostCents }])
    );

    const withStatus = rows.map((r) => {
      const treatmentInfo = treatmentByPatient.get(r.patientId);
      return {
        ...r,
        lastTreatmentName: treatmentInfo?.name ?? null,
        lastTreatmentCostCents: treatmentInfo?.costCents ?? null,
        status: (r.balanceCents > 0 ? "due" : "settled") as "due" | "settled",
      };
    });

    let filtered = withStatus;
    if (options?.balanceFilter === "due") {
      filtered = withStatus.filter((p) => p.status === "due");
    } else if (options?.balanceFilter === "settled") {
      filtered = withStatus.filter((p) => p.status === "settled");
    }

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

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
      error: "Something went wrong loading patient billing.",
      code: "SERVER_ERROR",
    };
  }
}