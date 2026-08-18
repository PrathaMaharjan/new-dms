import { requireSession, SessionError } from "@/lib/auth/get-session";
import { checkOwnerOrManager, CommissionErrorCode } from "../controller";
import { setRateSchema } from "@/lib/validators/ommissions";
import { db } from "@/db";
import {
  commissionExperienceTiers,
  treatmentCommissionRates,
  treatments,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Upsert - setting a rate for a treatment+tier pair that already has one
// simply replaces it, same "resubmit the form" reasoning as the
// treatment supply list's replace-on-save pattern.
export type SetRateResult =
  | { success: true }
  | { success: false; error: string; code: CommissionErrorCode };

export async function setCommissionRate(
  input: unknown,
): Promise<SetRateResult> {
  try {
    const session = await requireSession();

    if (!(await checkOwnerOrManager(session.userId))) {
      return {
        success: false,
        error: "Only an owner or manager can set commission rates.",
        code: "FORBIDDEN",
      };
    }

    const parsed = setRateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;
    const treatment = await db.query.treatments.findFirst({
      where: eq(treatments.id, data.treatmentId),
    });
    if (!treatment) {
      return {
        success: false,
        error: "Treatment not found.",
        code: "NOT_FOUND",
      };
    }

    const tier = await db.query.commissionExperienceTiers.findFirst({
      where: and(
        eq(commissionExperienceTiers.id, data.tierId),
        eq(commissionExperienceTiers.orgId, session.orgId),
      ),
    });
    if (!tier) {
      return { success: false, error: "Tier not found.", code: "NOT_FOUND" };
    }

    const existing = await db.query.treatmentCommissionRates.findFirst({
      where: and(
        eq(treatmentCommissionRates.treatmentId, data.treatmentId),
        eq(treatmentCommissionRates.tierId, data.tierId),
      ),
    });
    if (existing) {
      await db
        .update(treatmentCommissionRates)
        .set({ commissionPercent: data.commissionPercent })
        .where(eq(treatmentCommissionRates.id, existing.id));
    } else {
      await db.insert(treatmentCommissionRates).values(data);
    }

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong setting the commission rate.",
      code: "SERVER_ERROR",
    };
  }
}

export type RateMatrixRow = {
  treatmentId: string;
  treatmentName: string;
  tierId: string;
  tierName: string;
  commissionPercent: number | null;
};
export type GetRateMatrixResult =
  | { success: true; matrix: RateMatrixRow[] }
  | { success: false; error: string; code: CommissionErrorCode };

export async function getCommissionRateMatrix(
  locationId: string,
): Promise<GetRateMatrixResult> {
  try {
    const session = await requireSession();

    const [treatmentRows, tierRows, rateRows] = await Promise.all([
      db.query.treatments.findMany({
        where: eq(treatments.locationId, locationId),
      }),
      db.query.commissionExperienceTiers.findMany({
        where: eq(commissionExperienceTiers.orgId, session.orgId),
      }),
      db
        .select({
          treatmentId: treatmentCommissionRates.treatmentId,
          tierId: treatmentCommissionRates.tierId,
          commissionPercent: treatmentCommissionRates.commissionPercent,
        })
        .from(treatmentCommissionRates)
        .innerJoin(
          treatments,
          eq(treatmentCommissionRates.treatmentId, treatments.id),
        )
        .where(eq(treatments.locationId, locationId)),
    ]);

    const rateByKey = new Map(
      rateRows.map((r) => [
        `${r.treatmentId}-${r.tierId}`,
        r.commissionPercent,
      ]),
    );
    const matrix: RateMatrixRow[] = [];
    for (const t of treatmentRows) {
      for (const tier of tierRows) {
        matrix.push({
          treatmentId: t.id,
          treatmentName: t.name,
          tierId: tier.id,
          tierName: tier.name,
          commissionPercent: rateByKey.get(`${t.id}-${tier.id}`) ?? null,
        });
      }
    }

    return { success: true, matrix };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the rate matrix.",
      code: "SERVER_ERROR",
    };
  }
}
