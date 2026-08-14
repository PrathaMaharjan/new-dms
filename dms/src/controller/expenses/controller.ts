import { db } from "@/db";
import {
  expenseCategories,
  expenses,
  inventoryItems,
  inventoryMovements,
  locations,
  userLocationRoles,
  users,
} from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import {
  createExpenseCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
} from "@/lib/validators/expenses";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

export type ExpenseErrorCode =
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

// Reused from updateAppointmentStatus's forceComplete check - same
// definition, one shared source of truth for "is this person owner or
// manager" rather than duplicating the logic per feature.
async function checkOwnerOrManager(userId: string): Promise<boolean> {
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

export type CreateExpenseCategoryResult =
  | { success: true; category: { id: string; name: string } }
  | { success: false; error: string; code: ExpenseErrorCode };

export async function createExpenseCategory(
  input: unknown,
): Promise<CreateExpenseCategoryResult> {
  try {
    const session = await requireSession();

    if (!(await checkOwnerOrManager(session.userId))) {
      return {
        success: false,
        error: "Only an owner or manager can create expense categories.",
        code: "FORBIDDEN",
      };
    }

    const parsed = createExpenseCategorySchema.safeParse(input);
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

    const [category] = await db
      .insert(expenseCategories)
      .values({
        orgId: session.orgId,
        locationId: data.locationId,
        name: data.name,
      })
      .returning();

    return {
      success: true,
      category: { id: category.id, name: category.name },
    };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    if (getPgErrorCode(err) === "23505") {
      return {
        success: false,
        error: "A category with this name already exists at this location.",
        code: "DUPLICATE",
      };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong creating the category.",
      code: "SERVER_ERROR",
    };
  }
}
export type GetExpenseCategoriesResult =
  | { success: true; categories: { id: string; name: string }[] }
  | { success: false; error: string; code: ExpenseErrorCode };

export async function getExpenseCategories(
  locationId: string,
): Promise<GetExpenseCategoriesResult> {
  try {
    const session = await requireSession();

    const results = await db
      .select({ id: expenseCategories.id, name: expenseCategories.name })
      .from(expenseCategories)
      .innerJoin(locations, eq(expenseCategories.locationId, locations.id))
      .where(
        and(
          eq(expenseCategories.locationId, locationId),
          eq(locations.orgId, session.orgId),
          isNull(expenseCategories.deletedAt),
        ),
      )
      .orderBy(expenseCategories.name);

    return { success: true, categories: results };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading categories.",
      code: "SERVER_ERROR",
    };
  }
}

export type DeleteExpenseCategoryResult =
  | { success: true }
  | { success: false; error: string; code: ExpenseErrorCode };
export async function deleteExpenseCategory(
  categoryId: string,
  locationId: string,
): Promise<DeleteExpenseCategoryResult> {
  try {
    const session = await requireSession();

    if (!(await checkOwnerOrManager(session.userId))) {
      return {
        success: false,
        error: "Only an owner or manager can delete expense categories.",
        code: "FORBIDDEN",
      };
    }

    const [deleted] = await db
      .update(expenseCategories)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(expenseCategories.id, categoryId),
          eq(expenseCategories.locationId, locationId),
          eq(expenseCategories.orgId, session.orgId),
          isNull(expenseCategories.deletedAt),
        ),
      )
      .returning();

    if (!deleted) {
      return {
        success: false,
        error: "Category not found.",
        code: "NOT_FOUND",
      };
    }
    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong deleting the category.",
      code: "SERVER_ERROR",
    };
  }
}

// ---------- Expenses ----------

export type CreateExpenseResult =
  | { success: true; expenseId: string }
  | { success: false; error: string; code: ExpenseErrorCode };

export async function createExpense(
  input: unknown,
): Promise<CreateExpenseResult> {
  try {
    const session = await requireSession();

    if (!(await checkOwnerOrManager(session.userId))) {
      return {
        success: false,
        error: "Only an owner or manager can record expenses.",
        code: "FORBIDDEN",
      };
    }

    const parsed = createExpenseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;
    console.log("data ",data)

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
    const category = await db.query.expenseCategories.findFirst({
      where: and(
        eq(expenseCategories.id, data.categoryId),
        eq(expenseCategories.locationId, data.locationId), // ADDED
        eq(expenseCategories.orgId, session.orgId),
        isNull(expenseCategories.deletedAt),
      ),
    });
    if (!category) {
      return {
        success: false,
        error: "Category not found for this location.",
        code: "NOT_FOUND",
      };
    }
    const [expense] = await db
      .insert(expenses)
      .values({
        orgId: session.orgId,
        expenseNote: data.expenseNote,
        locationId: data.locationId,
        categoryId: data.categoryId,
        amountCents: data.amountCents,
        description: data.description,
        expenseDate: data.expenseDate,
        createdBy: session.userId,
      })
      .returning();

    return { success: true, expenseId: expense.id };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong recording the expense.",
      code: "SERVER_ERROR",
    };
  }
}

// delete
export type DeleteExpenseResult =
  | { success: true }
  | { success: false; error: string; code: ExpenseErrorCode };

export async function deleteExpense(
  expenseId: string,
): Promise<DeleteExpenseResult> {
  try {
    const session = await requireSession();

    if (!(await checkOwnerOrManager(session.userId))) {
      return {
        success: false,
        error: "Only an owner or manager can delete expenses.",
        code: "FORBIDDEN",
      };
    }

    const [deleted] = await db
      .update(expenses)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(expenses.id, expenseId),
          eq(expenses.orgId, session.orgId),
          isNull(expenses.deletedAt),
        ),
      )
      .returning();

    if (!deleted) {
      return { success: false, error: "Expense not found.", code: "NOT_FOUND" };
    }
    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong deleting the expense.",
      code: "SERVER_ERROR",
    };
  }
}

export type UpdateExpenseResult =
  | { success: true }
  | { success: false; error: string; code: ExpenseErrorCode };

export async function updateExpense(
  expenseId: string,
  input: unknown,
): Promise<UpdateExpenseResult> {
  try {
    const session = await requireSession();

    if (!(await checkOwnerOrManager(session.userId))) {
      return {
        success: false,
        error: "Only an owner or manager can edit expenses.",
        code: "FORBIDDEN",
      };
    }

    const parsed = updateExpenseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    if (Object.keys(parsed.data).length === 0) {
      return {
        success: false,
        error: "No fields to update.",
        code: "VALIDATION",
      };
    }
    const [updated] = await db
      .update(expenses)
      .set(parsed.data)
      .where(
        and(
          eq(expenses.id, expenseId),
          eq(expenses.orgId, session.orgId),
          isNull(expenses.deletedAt),
        ),
      )
      .returning();

    if (!updated) {
      return { success: false, error: "Expense not found.", code: "NOT_FOUND" };
    }
    return { success: true };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong updating the expense.",
      code: "SERVER_ERROR",
    };
  }
}

// get expenses
export type CombinedExpenseRow = {
  id: string;
  source: "expense" | "inventory_purchase";
  categoryName: string;
  amountCents: number;
  description: string | null;
  date: string; // YYYY-MM-DD
  createdByName: string;
  createdAt: Date;
};

export type GetCombinedExpensesResult =
  | {
      success: true;
      expenses: CombinedExpenseRow[];
      totalCents: number;
      pagination: { total: number; limit: number; offset: number };
    }
  | { success: false; error: string; code: ExpenseErrorCode };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}


export async function getCombinedExpenses(
  options?: {
    locationId?: string;
    categoryId?: string;
    thisMonth?: boolean;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }
): Promise<GetCombinedExpensesResult> {
  try {
    const session = await requireSession();

    const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(options?.offset ?? 0, 0);

    const now = new Date();
    const rangeStart = options?.thisMonth ? startOfMonth(now) : options?.from ? new Date(options.from) : undefined;
    const rangeEnd = options?.thisMonth ? endOfMonth(now) : options?.to ? new Date(options.to) : undefined;

    const expenseConditions = [eq(expenses.orgId, session.orgId), isNull(expenses.deletedAt)];
    if (options?.locationId) expenseConditions.push(eq(expenses.locationId, options.locationId));
    if (options?.categoryId) expenseConditions.push(eq(expenses.categoryId, options.categoryId));
    if (rangeStart) expenseConditions.push(sql`${expenses.expenseDate} >= ${rangeStart.toISOString().slice(0, 10)}`);
    if (rangeEnd) expenseConditions.push(sql`${expenses.expenseDate} <= ${rangeEnd.toISOString().slice(0, 10)}`);

    const movementConditions = [
      eq(locations.orgId, session.orgId),
      eq(inventoryMovements.type, "received"),
      isNotNull(inventoryMovements.costCents),
    ];
    if (options?.locationId) movementConditions.push(eq(inventoryMovements.locationId, options.locationId));
    if (rangeStart) movementConditions.push(sql`${inventoryMovements.createdAt} >= ${rangeStart}`);
    if (rangeEnd) movementConditions.push(sql`${inventoryMovements.createdAt} <= ${rangeEnd}`);

    const [expenseRows, purchaseRows] = await Promise.all([
      db
        .select({
          id: expenses.id,
          categoryName: expenseCategories.name,
          amountCents: expenses.amountCents,
          description: expenses.description,
          expenseNote: expenses.expenseNote, // ADDED
          date: sql<string>`${expenses.expenseDate}`,
          createdByName: users.name,
          createdAt: expenses.createdAt,
        })
        .from(expenses)
        .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
        .innerJoin(users, eq(expenses.createdBy, users.id))
        .where(and(...expenseConditions)),

      options?.categoryId
        ? []
        : await db
            .select({
              id: inventoryMovements.id,
              itemName: inventoryItems.name,
              costCents: inventoryMovements.costCents,
              note: inventoryMovements.note,
              expenseNote: inventoryMovements.expenseNote, // ADDED
              createdAt: inventoryMovements.createdAt,
              createdByName: users.name,
            })
            .from(inventoryMovements)
            .innerJoin(inventoryItems, eq(inventoryMovements.itemId, inventoryItems.id))
            .innerJoin(locations, eq(inventoryMovements.locationId, locations.id))
            .innerJoin(users, eq(inventoryMovements.recordedByUserId, users.id))
            .where(and(...movementConditions)),
    ]);

    const combined: CombinedExpenseRow[] = [
      ...expenseRows.map((e) => ({
        id: e.id,
        source: "expense" as const,
        categoryName: e.categoryName,
        amountCents: e.amountCents,
        description: e.description,
        expenseNote: e.expenseNote, // ADDED
        date: e.date,
        createdByName: e.createdByName,
        createdAt: e.createdAt,
      })),
      ...purchaseRows.map((m) => ({
        id: m.id,
        source: "inventory_purchase" as const,
        categoryName: m.itemName,
        amountCents: m.costCents!,
        description: m.note,
        expenseNote: m.expenseNote, // ADDED
        date: m.createdAt.toISOString().slice(0, 10),
        createdByName: m.createdByName,
        createdAt: m.createdAt,
      })),
    ];

    combined.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const totalCents = combined.reduce((sum, row) => sum + row.amountCents, 0);
    const total = combined.length;
    const paged = combined.slice(offset, offset + limit);

    return { success: true, expenses: paged, totalCents, pagination: { total, limit, offset } };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading expenses.", code: "SERVER_ERROR" };
  }
}
