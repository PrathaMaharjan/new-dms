import { db } from "@/db";
import { appointments, inventoryItems, locations, treatments, treatmentSupplies } from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { createTreatmentSchema, updateTreatmentSchema } from "@/lib/validators/treatments";
import { and, eq, inArray, sql } from "drizzle-orm";
import { checkInventoryEnabled } from "../inventory/inventoryItem/controller";
import { getImageUrl } from "@/lib/cloudinary/storage";

export type TreatmentErrorCode =
  | "UNAUTHORIZED"
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
async function findOwnedTreatment(treatmentId: string, orgId: string) {
  const rows = await db
    .select({ id: treatments.id })
    .from(treatments)
    .innerJoin(locations, eq(treatments.locationId, locations.id))
    .where(and(eq(treatments.id, treatmentId), eq(locations.orgId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

let hasEnsuredImageUrlColumn = false;
async function ensureImageUrlColumn() {
  if (hasEnsuredImageUrlColumn) return;
  try {
    await db.execute(sql`ALTER TABLE treatments ADD COLUMN IF NOT EXISTS image_url text;`);
    hasEnsuredImageUrlColumn = true;
  } catch (e) {
    // Ignore if already exists
  }
}

export type CreateTreatmentResult =
  | { success: true; treatment: typeof treatments.$inferSelect }
  | { success: false; error: string; code: TreatmentErrorCode };

export async function createTreatment(input: unknown): Promise<CreateTreatmentResult> {
  try {
    const session = await requireSession();
    await ensureImageUrlColumn();

    const parsed = createTreatmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const data = parsed.data;

    const location = await db.query.locations.findFirst({
      where: and(eq(locations.id, data.locationId), eq(locations.orgId, session.orgId)),
    });
    if (!location) {
      return { success: false, error: "Location not found.", code: "NOT_FOUND" };
    }

    const inventoryOn = await checkInventoryEnabled(session.orgId);

    const treatmentPhoto = data.photoKey
      ? getImageUrl(data.photoKey)
      : data.imageUrl ?? null;

    const treatment = await db.transaction(async (tx) => {
      const [newTreatment] = await tx
        .insert(treatments)
        .values({
          locationId: data.locationId,
          name: data.name,
          category: data.category,
          durationMinutes: data.durationMinutes,
          priceCents: data.priceCents,
          sessions: data.sessions,
          anesthesia: data.anesthesia,
          recoveryTime: data.recoveryTime,
          description: data.description,
          procedureSteps: data.procedureSteps,
          aftercareInstructions: data.aftercareInstructions,
          imageUrl: treatmentPhoto,
        })
        .returning();

      if (inventoryOn && !data.hasNoSupplies && data.supplies) {
        await tx.insert(treatmentSupplies).values(
          data.supplies.map((s) => ({
            treatmentId: newTreatment.id,
            itemId: s.itemId,
            quantityRequired: s.quantityRequired,
          }))
        );
      }

      return newTreatment;
    });

    return { success: true, treatment };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return { success: false, error: "A treatment with this name already exists at this location.", code: "DUPLICATE" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong creating the treatment.", code: "SERVER_ERROR" };
  }
}

export type TreatmentSupplyRow = { itemId: string; itemName: string; quantityRequired: number; unit: string };

export type GetTreatmentsResult =
  | {
      success: true;
      treatments: ((typeof treatments.$inferSelect) & { supplies: TreatmentSupplyRow[] })[];
      pagination: { total: number; limit: number; offset: number };
    }
  | { success: false; error: string; code: TreatmentErrorCode };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function getTreatments(
  locationId?: string,
  options?: { limit?: number; offset?: number }
): Promise<GetTreatmentsResult> {
  try {
    const session = await requireSession();
    await ensureImageUrlColumn();

    const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(options?.offset ?? 0, 0);

    // ADDED - checked once, up front, since it decides whether the
    // supply-fetching work below even needs to happen at all.
    const inventoryOn = await checkInventoryEnabled(session.orgId);

    const whereClause = locationId
      ? and(eq(treatments.locationId, locationId), eq(locations.orgId, session.orgId))
      : eq(locations.orgId, session.orgId);

    const [results, countResult] = await Promise.all([
      db
        .select({
          id: treatments.id,
          locationId: treatments.locationId,
          name: treatments.name,
          category: treatments.category,
          durationMinutes: treatments.durationMinutes,
          priceCents: treatments.priceCents,
          sessions: treatments.sessions,
          anesthesia: treatments.anesthesia,
          recoveryTime: treatments.recoveryTime,
          description: treatments.description,
          procedureSteps: treatments.procedureSteps,
          aftercareInstructions: treatments.aftercareInstructions,
          imageUrl: treatments.imageUrl,
          createdAt: treatments.createdAt,
          updatedAt: treatments.updatedAt,
        })
        .from(treatments)
        .innerJoin(locations, eq(treatments.locationId, locations.id))
        .where(whereClause)
        .orderBy(treatments.name)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(treatments)
        .innerJoin(locations, eq(treatments.locationId, locations.id))
        .where(whereClause),
    ]);

    let treatmentsWithSupplies = results.map((t) => ({ ...t, supplies: [] as TreatmentSupplyRow[] }));

    if (inventoryOn) {
      const treatmentIds = results.map((t) => t.id);
      const supplyRows = treatmentIds.length
        ? await db
            .select({
              treatmentId: treatmentSupplies.treatmentId,
              itemId: treatmentSupplies.itemId,
              itemName: inventoryItems.name,
              unit: inventoryItems.unit,
              quantityRequired: treatmentSupplies.quantityRequired,
            })
            .from(treatmentSupplies)
            .innerJoin(inventoryItems, eq(treatmentSupplies.itemId, inventoryItems.id))
            .where(inArray(treatmentSupplies.treatmentId, treatmentIds))
        : [];

      const suppliesByTreatment = new Map<string, TreatmentSupplyRow[]>();
      for (const row of supplyRows) {
        const list = suppliesByTreatment.get(row.treatmentId) ?? [];
        list.push({ itemId: row.itemId, itemName: row.itemName, unit: row.unit, quantityRequired: row.quantityRequired });
        suppliesByTreatment.set(row.treatmentId, list);
      }

      treatmentsWithSupplies = results.map((t) => ({
        ...t,
        supplies: suppliesByTreatment.get(t.id) ?? [],
      }));
    }

    const total = countResult[0]?.count ?? 0;
    return { success: true, treatments: treatmentsWithSupplies, pagination: { total, limit, offset } };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading treatments.", code: "SERVER_ERROR" };
  }
}
// ------------------------------------update --------------------------------
export type UpdateTreatmentResult =
  | { success: true; treatment: typeof treatments.$inferSelect }
  | { success: false; error: string; code: TreatmentErrorCode };
export async function updateTreatment(treatmentId: string, input: unknown): Promise<UpdateTreatmentResult> {
  try {
    const session = await requireSession();

    const parsed = updateTreatmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const data = parsed.data;

    const owned = await findOwnedTreatment(treatmentId, session.orgId);
    if (!owned) {
      return { success: false, error: "Treatment not found.", code: "NOT_FOUND" };
    }

    const { supplies, hasNoSupplies, ...treatmentFields } = data;

    const updateValues: Partial<typeof treatments.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (treatmentFields.name !== undefined) updateValues.name = treatmentFields.name;
    if (treatmentFields.category !== undefined) updateValues.category = treatmentFields.category;
    if (treatmentFields.durationMinutes !== undefined) updateValues.durationMinutes = treatmentFields.durationMinutes;
    if (treatmentFields.priceCents !== undefined) updateValues.priceCents = treatmentFields.priceCents;
    if (treatmentFields.sessions !== undefined && treatmentFields.sessions !== null) updateValues.sessions = treatmentFields.sessions;
    if (treatmentFields.anesthesia !== undefined && treatmentFields.anesthesia !== null) updateValues.anesthesia = treatmentFields.anesthesia;
    if (treatmentFields.recoveryTime !== undefined) updateValues.recoveryTime = treatmentFields.recoveryTime;
    if (treatmentFields.description !== undefined) updateValues.description = treatmentFields.description;
    if (treatmentFields.procedureSteps !== undefined) updateValues.procedureSteps = treatmentFields.procedureSteps;
    if (treatmentFields.aftercareInstructions !== undefined) updateValues.aftercareInstructions = treatmentFields.aftercareInstructions;
    if (treatmentFields.photoKey !== undefined) {
      updateValues.imageUrl = treatmentFields.photoKey ? getImageUrl(treatmentFields.photoKey) : null;
    } else if (treatmentFields.imageUrl !== undefined) {
      updateValues.imageUrl = treatmentFields.imageUrl;
    }

    const updated = await db.transaction(async (tx) => {
      const [updatedTreatment] = await tx
        .update(treatments)
        .set(updateValues)
        .where(eq(treatments.id, treatmentId))
        .returning();

      // Supplies only touched if the request actually included a
      // decision about them - omitting both fields entirely means "leave
      // the existing supply list alone," not "wipe it."
      if (supplies !== undefined || hasNoSupplies !== undefined) {
        await tx.delete(treatmentSupplies).where(eq(treatmentSupplies.treatmentId, treatmentId));

        if (!hasNoSupplies && supplies && supplies.length > 0) {
          await tx.insert(treatmentSupplies).values(
            supplies.map((s:any) => ({
              treatmentId,
              itemId: s.itemId,
              quantityRequired: s.quantityRequired,
            }))
          );
        }
      }

      return updatedTreatment;
    });

    return { success: true, treatment: updated };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return { success: false, error: "A treatment with this name already exists at this location.", code: "DUPLICATE" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating the treatment.", code: "SERVER_ERROR" };
  }
}

// ----------------------------------------dekete------------------------------------------

export type DeleteTreatmentResult =
  | { success: true }
  | { success: false; error: string; code: TreatmentErrorCode };
export async function deleteTreatment(treatmentId: string): Promise<DeleteTreatmentResult> {
  try {
    const session = await requireSession();

    const owned = await findOwnedTreatment(treatmentId, session.orgId);
    if (!owned) {
      return { success: false, error: "Treatment not found.", code: "NOT_FOUND" };
    }

    await db.transaction(async (tx) => {
      // 1. Unlink any appointments referencing this treatment so foreign key constraint doesn't block deletion
      await tx
        .update(appointments)
        .set({ treatmentId: sql`NULL` })
        .where(eq(appointments.treatmentId, treatmentId));

      // 2. Delete any treatment supplies
      await tx
        .delete(treatmentSupplies)
        .where(eq(treatmentSupplies.treatmentId, treatmentId));

      // 3. Delete the treatment itself
      await tx
        .delete(treatments)
        .where(eq(treatments.id, treatmentId));
    });

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error("Delete treatment error:", err);
    return { success: false, error: "Something went wrong deleting the treatment.", code: "SERVER_ERROR" };
  }
}


// get treatment name and id 
export type TreatmentOptionsResult =
  | { success: true; treatments: { id: string; name: string }[] }
  | { success: false; error: string; code: TreatmentErrorCode };

export async function getTreatmentOptions(locationId?: string): Promise<TreatmentOptionsResult> {
  try {
    // const session = await requireSession();

    // const whereClause = locationId
    //   ? and(eq(treatments.locationId, locationId), eq(locations.orgId, session.orgId))
    //   : eq(locations.orgId, session.orgId);

    const results = await db
      .select({ id: treatments.id, name: treatments.name })
      .from(treatments)
      // .innerJoin(locations, eq(treatments.locationId, locations.id))
      // .where(whereClause)
      // .orderBy(treatments.name);

    return { success: true, treatments: results };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading treatments.", code: "SERVER_ERROR" };
  }
}