import { pgTable, uuid, text, boolean, timestamp, integer, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { locations, organizations, users } from "./tenancy";
import { inventoryMovements } from "./inventory";
import { relations, sql } from "drizzle-orm";

export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    locationId: uuid("location_id").notNull().references(() => locations.id),
    name: text("name").notNull(),
    isDefault: boolean("is_default").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    locationActiveIdx: index("expense_categories_location_active_idx").on(table.locationId, table.deletedAt),
    locationNameUnique: uniqueIndex("expense_categories_location_name_unique")
      .on(table.locationId, table.name)
      .where(sql`${table.deletedAt} is null`),
  })
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    locationId: uuid("location_id").notNull().references(() => locations.id),
    categoryId: uuid("category_id").notNull().references(() => expenseCategories.id),
    amountCents: integer("amount_cents").notNull(),
    description: text("description"),
     expenseNote: text("expense_note"), 
    expenseDate: date("expense_date").notNull(),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    sourceInventoryMovementId: uuid("source_inventory_movement_id").references(() => inventoryMovements.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    locationDateIdx: index("expenses_location_date_idx").on(table.locationId, table.expenseDate, table.deletedAt),
    orgDateIdx: index("expenses_org_date_idx").on(table.orgId, table.expenseDate, table.deletedAt),
    locationCategoryIdx: index("expenses_location_category_idx").on(table.locationId, table.categoryId, table.deletedAt),
    createdByIdx: index("expenses_created_by_idx").on(table.createdBy, table.createdAt),
  })
);

export const expenseCategoriesRelations = relations(expenseCategories, ({ one, many }) => ({
  organization: one(organizations, { fields: [expenseCategories.orgId], references: [organizations.id] }),
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  organization: one(organizations, { fields: [expenses.orgId], references: [organizations.id] }),
  location: one(locations, { fields: [expenses.locationId], references: [locations.id] }),
  category: one(expenseCategories, { fields: [expenses.categoryId], references: [expenseCategories.id] }),
  createdByUser: one(users, { fields: [expenses.createdBy], references: [users.id] }),
}));