import { requireSession, SessionError } from "@/lib/auth/get-session";
import { InventoryErrorCode } from "../category/controller";
import { db } from "@/db";
import {
  inventoryCategories,
  inventoryItems,
  inventoryMovements,
  locations,
  organizations,
  users,
} from "@/db/schema";
import {
  addMovementSchema,
  createInventoryItemSchema,
  updateItemSchema,
} from "@/lib/validators/inventory";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

export async function checkInventoryEnabled(orgId: string): Promise<boolean> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });
  return org?.inventoryEnabled ?? false;
}

// ---------------------- create treatment item --------------------
export type CreateInventoryItemResult =
  | { success: true; item: { id: string; name: string } }
  | { success: false; error: string; code: InventoryErrorCode };

export async function createInventoryItem(
  input: unknown,
): Promise<CreateInventoryItemResult> {
  try {
    const session = await requireSession();

    const parsed = createInventoryItemSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;

    const location = await db.query.locations.findFirst({
      where: and(
        eq(locations.id, data.locationId),
        eq(locations.orgId, session.orgId),
      ),
    });
    if (!location) {
      return {
        success: false,
        error: "Location not found.",
        code: "NOT_FOUND",
      };
    }
    if (!(await checkInventoryEnabled(session.orgId))) {
      return {
        success: false,
        error: "Inventory tracking is turned off for your organization.",
        code: "VALIDATION",
      };
    }

    const [item] = await db
      .insert(inventoryItems)
      .values({
        locationId: data.locationId,
        name: data.name,
        unit: data.unit,
        priceCents: data.priceCents ?? 0,
        categoryId: data.categoryId,
        reorderThreshold: data.reorderThreshold ?? 0,
      })
      .returning();

    return { success: true, item: { id: item.id, name: item.name } };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong creating the item.",
      code: "SERVER_ERROR",
    };
  }
}

export type InventoryItemRow = {
  id: string;
  name: string;
  unit: string;
  priceCents: number;
  categoryName: string | null;
  reorderThreshold: number;
  currentStock: number;
  isLowStock: boolean;
};

export type GetInventoryItemsResult =
  | {
      success: true;
      items: InventoryItemRow[];
      pagination: { total: number; limit: number; offset: number };
    }
  | { success: false; error: string; code: InventoryErrorCode };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function getInventoryItems(
  locationId: string,
  options?: {
    search?: string;
    lowStockOnly?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<GetInventoryItemsResult> {
  try {
    const session = await requireSession();

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = Math.max(options?.offset ?? 0, 0);

    const conditions = [
      eq(inventoryItems.locationId, locationId),
      eq(locations.orgId, session.orgId),
    ];
    if (options?.search) {
      conditions.push(
        sql`${inventoryItems.name} ilike ${"%" + options.search + "%"}`,
      );
    }

    const allRows = await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        unit: inventoryItems.unit,
        priceCents: inventoryItems.priceCents,
        categoryName: inventoryCategories.name,
        reorderThreshold: inventoryItems.reorderThreshold,
        currentStock: sql<number>`coalesce(sum(${inventoryMovements.quantity}), 0)::int`,
      })
      .from(inventoryItems)
      .innerJoin(locations, eq(inventoryItems.locationId, locations.id))
      .leftJoin(
        inventoryCategories,
        eq(inventoryItems.categoryId, inventoryCategories.id),
      )
      .leftJoin(
        inventoryMovements,
        eq(inventoryMovements.itemId, inventoryItems.id),
      )
      .where(and(...conditions))
      .groupBy(inventoryItems.id, inventoryCategories.name);
    let filtered = allRows.map((r) => ({
      ...r,
      isLowStock: r.currentStock <= r.reorderThreshold,
    }));
    if (options?.lowStockOnly) {
      filtered = filtered.filter((r) => r.isLowStock);
    }

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return {
      success: true,
      items: paged,
      pagination: { total, limit, offset },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading inventory.",
      code: "SERVER_ERROR",
    };
  }
}

export type GetInventoryItemResult =
  | {
      success: true;
      item: {
        id: string;
        name: string;
        unit: string;
        priceCents: number;
        categoryId: string | null;
        categoryName: string | null;
        reorderThreshold: number;
        currentStock: number;
        isLowStock: boolean;
      };
    }
  | { success: false; error: string; code: InventoryErrorCode };

export async function getInventoryItem(
  itemId: string,
  locationId: string,
): Promise<GetInventoryItemResult> {
  try {
    const session = await requireSession();

    const [item] = await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        unit: inventoryItems.unit,
        priceCents: inventoryItems.priceCents,
        categoryId: inventoryItems.categoryId,
        categoryName: inventoryCategories.name,
        reorderThreshold: inventoryItems.reorderThreshold,
        currentStock: sql<number>`coalesce(sum(${inventoryMovements.quantity}), 0)::int`,
      })
      .from(inventoryItems)
      .innerJoin(locations, eq(inventoryItems.locationId, locations.id))
      .leftJoin(
        inventoryCategories,
        eq(inventoryItems.categoryId, inventoryCategories.id),
      )
      .leftJoin(
        inventoryMovements,
        eq(inventoryMovements.itemId, inventoryItems.id),
      )
      .where(
        and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.locationId, locationId),
          eq(locations.orgId, session.orgId),
          isNull(inventoryItems.deletedAt),
        ),
      )
      .groupBy(inventoryItems.id, inventoryCategories.name);
    if (!item) {
      return { success: false, error: "Item not found.", code: "NOT_FOUND" };
    }

    return {
      success: true,
      item: { ...item, isLowStock: item.currentStock <= item.reorderThreshold },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the item.",
      code: "SERVER_ERROR",
    };
  }
}

// ----------------------------------- UPDATE INVENTORY ITEM --------------------------------------------------------
export type UpdateInventoryItemResult =
  | { success: true; item: { id: string; name: string } }
  | { success: false; error: string; code: InventoryErrorCode };

// Optimized the same way updateStaff was - ownership check and the
// actual write happen in ONE statement (UPDATE...WHERE...RETURNING),
// not a separate SELECT-then-UPDATE. An empty RETURNING is itself the
// NOT_FOUND signal - no second round trip needed either way.
export async function updateInventoryItem(
  itemId: string,
  locationId: string,
  input: unknown,
): Promise<UpdateInventoryItemResult> {
  try {
    const session = await requireSession();

    const parsed = updateItemSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;

    if (Object.keys(data).length === 0) {
      return {
        success: false,
        error: "No fields to update.",
        code: "VALIDATION",
      };
    }

    // UPDATE ... FROM locations - a real JOIN, not a raw sql IN-subquery.
    // Postgres' planner executes this as a direct index lookup against
    // locations.id (the primary key), same ownership guarantee as
    // before, just expressed as a proper join instead of a membership
    // check against a subquery's result set. Also fully type-checked,
    // not a hand-written SQL string.
    const [updated] = await db
      .update(inventoryItems)
      .set(data)
      .from(locations)
      .where(
        and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.locationId, locationId),
          eq(inventoryItems.locationId, locations.id),
          eq(locations.orgId, session.orgId),
          isNull(inventoryItems.deletedAt),
        ),
      )
      .returning({
        id: inventoryItems.id,
        name: inventoryItems.name,
      });

    if (!updated) {
      return { success: false, error: "Item not found.", code: "NOT_FOUND" };
    }

    return { success: true, item: updated };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong updating the item.",
      code: "SERVER_ERROR",
    };
  }
}

export type DeleteInventoryItemResult =
  | { success: true }
  | { success: false; error: string; code: InventoryErrorCode };

// Soft delete, same one-statement approach - sets deletedAt directly in
// the same UPDATE that verifies ownership, rather than checking first
// and deleting second.
export async function deleteInventoryItem(
  itemId: string,
  locationId: string,
): Promise<DeleteInventoryItemResult> {
  try {
    const session = await requireSession();

    const [deleted] = await db
      .update(inventoryItems)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(inventoryItems.id, itemId),
          eq(inventoryItems.locationId, locationId),
          isNull(inventoryItems.deletedAt),
          sql`${inventoryItems.locationId} in (select id from ${locations} where org_id = ${session.orgId})`,
        ),
      )
      .returning();

    if (!deleted) {
      return { success: false, error: "Item not found.", code: "NOT_FOUND" };
    }

    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong removing the item.",
      code: "SERVER_ERROR",
    };
  }
}

// ---------- Movements ----------

export type AddMovementResult =
  | { success: true; movementId: string; newStock: number }
  | { success: false; error: string; code: InventoryErrorCode };

export async function addInventoryMovement(
  locationId: string,
  input: unknown,
): Promise<AddMovementResult> {
  try {
    const session = await requireSession();

    const parsed = addMovementSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;

    const item = await db.query.inventoryItems.findFirst({
      where: and(
        eq(inventoryItems.id, data.itemId),
        eq(inventoryItems.locationId, locationId),
      ),
    });
    if (!item) {
      return { success: false, error: "Item not found.", code: "NOT_FOUND" };
    }
    if (!(await checkInventoryEnabled(session.orgId))) {
      return {
        success: false,
        error: "Inventory tracking is turned off for your organization.",
        code: "VALIDATION",
      };
    }
    // "received" and positive "adjusted" entries add stock; "used",
    // "wasted", and negative "adjusted" reduce it - the sign comes
    // straight from what the caller sends, matching quantity's own
    // signed-value convention on the schema.
    const [movement] = await db
      .insert(inventoryMovements)
      .values({
        itemId: data.itemId,
        locationId,
        quantity: data.quantity,
        type: data.type,
        note: data.note,
        recordedByUserId: session.userId,
      })
      .returning();

    const [stockResult] = await db
      .select({
        stock: sql<number>`coalesce(sum(${inventoryMovements.quantity}), 0)::int`,
      })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.itemId, data.itemId));

    return {
      success: true,
      movementId: movement.id,
      newStock: stockResult.stock,
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong recording the movement.",
      code: "SERVER_ERROR",
    };
  }
}

// get inventory movemenr-------------
export type MovementHistoryResult =
  | {
      success: true;
      movements: {
        id: string;
        quantity: number;
        type: string;
        note: string | null;
        recordedByName: string;
        createdAt: Date;
      }[];
    }
  | { success: false; error: string; code: InventoryErrorCode };

export async function getMovementHistory(
  itemId: string,
): Promise<MovementHistoryResult> {
  try {
    await requireSession();

    const rows = await db
      .select({
        id: inventoryMovements.id,
        quantity: inventoryMovements.quantity,
        type: inventoryMovements.type,
        note: inventoryMovements.note,
        recordedByName: users.name,
        createdAt: inventoryMovements.createdAt,
      })
      .from(inventoryMovements)
      .innerJoin(users, eq(inventoryMovements.recordedByUserId, users.id))
      .where(eq(inventoryMovements.itemId, itemId))
      .orderBy(desc(inventoryMovements.createdAt));

    return { success: true, movements: rows };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading movement history.",
      code: "SERVER_ERROR",
    };
  }
}

export type LowStockCountResult =
  | {
      success: true;
      count: number;
      items: {
        id: string;
        name: string;
        currentStock: number;
        reorderThreshold: number;
      }[];
    }
  | { success: false; error: string; code: InventoryErrorCode };

export async function getLowStockCount(
  locationId: string,
): Promise<LowStockCountResult> {
  try {
    const session = await requireSession();

    // Same currentStock-via-sum math as getInventoryItems - now also
    // selecting name, since the caller wants to know WHICH items are
    // low, not just how many.
    const rows = await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        reorderThreshold: inventoryItems.reorderThreshold,
        currentStock: sql<number>`coalesce(sum(${inventoryMovements.quantity}), 0)::int`,
      })
      .from(inventoryItems)
      .innerJoin(locations, eq(inventoryItems.locationId, locations.id))
      .leftJoin(
        inventoryMovements,
        eq(inventoryMovements.itemId, inventoryItems.id),
      )
      .where(
        and(
          eq(inventoryItems.locationId, locationId),
          eq(locations.orgId, session.orgId),
          isNull(inventoryItems.deletedAt),
        ),
      )
      .groupBy(inventoryItems.id);

    const lowStockItems = rows.filter(
      (r) => r.currentStock <= r.reorderThreshold,
    );

    return { success: true, count: lowStockItems.length, items: lowStockItems };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading the low stock count.",
      code: "SERVER_ERROR",
    };
  }
}
