import { db } from "@/db";
import {
  commissionExperienceTiers,
  userLocationRoles,
  users,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { createTierSchema, updateTierSchema } from "@/lib/validators/ommissions";
import { and, eq } from "drizzle-orm";

export type CommissionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "DUPLICATE"
  | "SERVER_ERROR";

function getPgErrorCode(err: unknown): string | undefined {
  return (
    (err as { cause?: { code?: string } })?.cause?.code ??
    (err as { code?: string })?.code
  );
}

// Reused, matching the exact same helper already proven in the
// appointment-completion override and the expenses module.
export async function checkOwnerOrManager(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.isOwner) return true;
  const role = await db.query.userLocationRoles.findFirst({
    where: and(
      eq(userLocationRoles.userId, userId),
      eq(userLocationRoles.role, "manager"),
    ),
  });
  return !!role;
}

/*
The function createExperienceTier() creates an experience category for doctors in your organization.

For example, you want:

Junior   → 0–2 years
Senior   → 3–5 years
Expert   → 6+ years

The function is responsible for creating one of those tiers safely.

*/

export type CreateTierResult =
  | {
      success: true;
      tier: {
        id: string;
        name: string;
        minYears: number;
        maxYears: number | null;
      };
    }
  | { success: false; error: string; code: CommissionErrorCode };

export async function createExperienceTier(
  input: unknown,
): Promise<CreateTierResult> {
  try {
    const session = await requireSession();

    if (!(await checkOwnerOrManager(session.userId))) {
      return {
        success: false,
        error: "Only an owner or manager can create commission tiers.",
        code: "FORBIDDEN",
      };
    }

    const parsed = createTierSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;
    const existingTiers = await db
      .select({
        minYears: commissionExperienceTiers.minYears,
        maxYears: commissionExperienceTiers.maxYears,
      })
      .from(commissionExperienceTiers)
      .where(eq(commissionExperienceTiers.orgId, session.orgId));

    const newMax = data.maxYears ?? Infinity;
    const overlaps = existingTiers.some((t) => {
      const existingMax = t.maxYears ?? Infinity;
      return data.minYears <= existingMax && newMax >= t.minYears;
    });
    if (overlaps) {
      return {
        success: false,
        error: "This year range overlaps with an existing tier.",
        code: "DUPLICATE",
      };
    }
    const [tier] = await db
      .insert(commissionExperienceTiers)
      .values({
        orgId: session.orgId,
        name: data.name,
        minYears: data.minYears,
        maxYears: data.maxYears ?? null,
      })
      .returning();

    return { success: true, tier };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong creating the tier.",
      code: "SERVER_ERROR",
    };
  }
}

export type GetTiersResult =
  | { success: true; tiers: { id: string; name: string; minYears: number; maxYears: number | null }[] }
  | { success: false; error: string; code: CommissionErrorCode };

export async function getExperienceTiers(): Promise<GetTiersResult> {
  try {
    const session = await requireSession();

    const tiers = await db
      .select({ id: commissionExperienceTiers.id, name: commissionExperienceTiers.name, minYears: commissionExperienceTiers.minYears, maxYears: commissionExperienceTiers.maxYears })
      .from(commissionExperienceTiers)
      .where(eq(commissionExperienceTiers.orgId, session.orgId))
      .orderBy(commissionExperienceTiers.minYears);

    return { success: true, tiers };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading tiers.", code: "SERVER_ERROR" };
  }
}

export type UpdateTierResult = { success: true } | { success: false; error: string; code: CommissionErrorCode };

export async function updateExperienceTier(tierId: string, input: unknown): Promise<UpdateTierResult> {
  try {
    const session = await requireSession();

    if (!(await checkOwnerOrManager(session.userId))) {
      return { success: false, error: "Only an owner or manager can edit commission tiers.", code: "FORBIDDEN" };
    }

    const parsed = updateTierSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    if (Object.keys(parsed.data).length === 0) {
      return { success: false, error: "No fields to update.", code: "VALIDATION" };
    }
        const [updated] = await db
      .update(commissionExperienceTiers)
      .set(parsed.data)
      .where(and(eq(commissionExperienceTiers.id, tierId), eq(commissionExperienceTiers.orgId, session.orgId)))
      .returning();

    if (!updated) {
      return { success: false, error: "Tier not found.", code: "NOT_FOUND" };
    }
    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating the tier.", code: "SERVER_ERROR" };
  }
}


// --------------------- delete ----------------------------------
export type DeleteTierResult = { success: true } | { success: false; error: string; code: CommissionErrorCode };

export async function deleteExperienceTier(tierId: string): Promise<DeleteTierResult> {
  try {
    const session = await requireSession();

    if (!(await checkOwnerOrManager(session.userId))) {
      return { success: false, error: "Only an owner or manager can delete commission tiers.", code: "FORBIDDEN" };
    }
    try {
      const [deleted] = await db
        .delete(commissionExperienceTiers)
        .where(and(eq(commissionExperienceTiers.id, tierId), eq(commissionExperienceTiers.orgId, session.orgId)))
        .returning();

      if (!deleted) {
        return { success: false, error: "Tier not found.", code: "NOT_FOUND" };
      }
      return { success: true };
    } catch (err) {
      if (getPgErrorCode(err) === "23503") {
        return { success: false, error: "This tier has already been used in recorded commissions and cannot be deleted.", code: "VALIDATION" };
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong deleting the tier.", code: "SERVER_ERROR" };
  }
}

