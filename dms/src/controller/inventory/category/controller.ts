import { db } from "@/db";
import { locations } from "@/db/schema";
import { inventoryCategories, inventoryItems } from "@/db/schema/inventory";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { createCategorySchema } from "@/lib/validators/inventory";
import { and, eq, isNull, sql } from "drizzle-orm";
import z from "zod";

export type InventoryErrorCode = "UNAUTHORIZED" | "VALIDATION" | "NOT_FOUND" | "DUPLICATE" | "SERVER_ERROR";

function getPgErrorCode(err: unknown): string | undefined {
  return (err as { cause?: { code?: string } })?.cause?.code ?? (err as { code?: string })?.code;
}

// ---------- Categories ----------

export type CreateCategoryResult =
  | { success: true; category: { id: string; name: string } }
  | { success: false; error: string; code: InventoryErrorCode };
  export async function createCategory(input: unknown): Promise<CreateCategoryResult> {
  try {
    const session = await requireSession();

    const parsed = createCategorySchema.safeParse(input);
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

    const [category] = await db
      .insert(inventoryCategories)
      .values({ locationId: data.locationId, name: data.name })
      .returning();

    return { success: true, category: { id: category.id, name: category.name } };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return { success: false, error: "A category with this name already exists.", code: "DUPLICATE" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong creating the category.", code: "SERVER_ERROR" };
  }
}

export type GetCategoriesResult =
  | { success: true; categories: { id: string; name: string }[] }
  | { success: false; error: string; code: InventoryErrorCode };

export async function getCategories(locationId: string): Promise<GetCategoriesResult> {
  try {
    const session = await requireSession();

    const results = await db
      .select({ id: inventoryCategories.id, name: inventoryCategories.name })
      .from(inventoryCategories)
      .innerJoin(locations, eq(inventoryCategories.locationId, locations.id))
      .where(and(eq(inventoryCategories.locationId, locationId), eq(locations.orgId, session.orgId)))
      .orderBy(inventoryCategories.name);

    return { success: true, categories: results };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading categories.", code: "SERVER_ERROR" };
  }
}

export const updateCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
});

// ---------- getOne ----------

export type GetCategoryResult =
  | { success: true; category: { id: string; name: string; itemCount: number } }
  | { success: false; error: string; code: InventoryErrorCode };

// itemCount included here since it's genuinely useful context on a
// category's detail view - answers "how many items would be affected
// if I rename/delete this" in the same round trip, no separate call needed.
export async function getCategory(categoryId: string, locationId: string): Promise<GetCategoryResult> {
  try {
    const session = await requireSession();

    const [category] = await db
      .select({
        id: inventoryCategories.id,
        name: inventoryCategories.name,
        itemCount: sql<number>`count(${inventoryItems.id}) filter (where ${inventoryItems.deletedAt} is null)::int`,
      })
      .from(inventoryCategories)
      .innerJoin(locations, eq(inventoryCategories.locationId, locations.id))
      .leftJoin(inventoryItems, eq(inventoryItems.categoryId, inventoryCategories.id))
      .where(
        and(
          eq(inventoryCategories.id, categoryId),
          eq(inventoryCategories.locationId, locationId),
          eq(locations.orgId, session.orgId),
          isNull(inventoryCategories.deletedAt)
        )
      )
      .groupBy(inventoryCategories.id);

    if (!category) {
      return { success: false, error: "Category not found.", code: "NOT_FOUND" };
    }
    return { success: true, category };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the category.", code: "SERVER_ERROR" };
  }
}

// ---------- update ----------

export type UpdateCategoryResult =
  | { success: true; category: { id: string; name: string } }
  | { success: false; error: string; code: InventoryErrorCode };

// Ownership check and write combined into one UPDATE...RETURNING, same
// optimization already used for updateInventoryItem - no separate SELECT.
export async function updateCategory(
  categoryId: string,
  locationId: string,
  input: unknown
): Promise<UpdateCategoryResult> {
  try {
    const session = await requireSession();

    const parsed = updateCategorySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }

    const [updated] = await db
      .update(inventoryCategories)
      .set({ name: parsed.data.name })
      .where(
        and(
          eq(inventoryCategories.id, categoryId),
          eq(inventoryCategories.locationId, locationId),
          isNull(inventoryCategories.deletedAt),
          sql`${inventoryCategories.locationId} in (select id from ${locations} where org_id = ${session.orgId})`
        )
      )
      .returning();

    if (!updated) {
      return { success: false, error: "Category not found.", code: "NOT_FOUND" };
    }
    return { success: true, category: { id: updated.id, name: updated.name } };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return { success: false, error: "A category with this name already exists.", code: "DUPLICATE" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating the category.", code: "SERVER_ERROR" };
  }
}

// ---------- delete (soft) ----------

export type DeleteCategoryResult = { success: true } | { success: false; error: string; code: InventoryErrorCode };

// Soft delete only - items pointing at this category keep their
// categoryId untouched (a stale reference, harmless since getInventoryItems
// already left-joins categories and shows null for anything unmatched).
// Genuinely reassigning those items to "uncategorized" is a real, separate
// decision worth its own discussion if that matters more than this.
export async function deleteCategory(categoryId: string, locationId: string): Promise<DeleteCategoryResult> {
  try {
    const session = await requireSession();

    const [deleted] = await db
      .update(inventoryCategories)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(inventoryCategories.id, categoryId),
          eq(inventoryCategories.locationId, locationId),
          isNull(inventoryCategories.deletedAt),
          sql`${inventoryCategories.locationId} in (select id from ${locations} where org_id = ${session.orgId})`
        )
      )
      .returning();

    if (!deleted) {
      return { success: false, error: "Category not found.", code: "NOT_FOUND" };
    }
    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong removing the category.", code: "SERVER_ERROR" };
  }
}


