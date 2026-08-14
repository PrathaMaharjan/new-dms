import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { locations, users } from "./tenancy";
import { appointments } from "./scheduling";

export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "received",
  "used",
  "wasted",
  "adjusted",
]);
export const inventoryCategories = pgTable(
  "inventory_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    locationIdx: index("inventory_categories_location_id_idx").on(
      table.locationId,
    ),
    locationNameUnique: unique("inventory_categories_location_name_unique").on(
      table.locationId,
      table.name,
    ),
  }),
);

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    categoryId: uuid("category_id").references(() => inventoryCategories.id),
    reorderThreshold: integer("reorder_threshold").notNull().default(0),
    deletedAt: timestamp("deleted_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    locationIdx: index("inventory_items_location_id_idx").on(table.locationId),
  }),
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    type: inventoryMovementTypeEnum("type").notNull(),
    note: text("note"),
    expenseNote: text("expense_note"),
    costCents: integer("cost_cents"),
    appointmentId: uuid("appointment_id").references(() => appointments.id),
    recordedByUserId: uuid("recorded_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    itemCreatedIdx: index("inventory_movements_item_created_idx").on(
      table.itemId,
      table.createdAt,
    ),
    locationIdx: index("inventory_movements_location_id_idx").on(
      table.locationId,
    ),
  }),
);

export const inventoryCategoriesRelations = relations(
  inventoryCategories,
  ({ one, many }) => ({
    location: one(locations, {
      fields: [inventoryCategories.locationId],
      references: [locations.id],
    }),
    items: many(inventoryItems),
  }),
);

export const inventoryItemsRelations = relations(
  inventoryItems,
  ({ one, many }) => ({
    location: one(locations, {
      fields: [inventoryItems.locationId],
      references: [locations.id],
    }),
    category: one(inventoryCategories, {
      fields: [inventoryItems.categoryId],
      references: [inventoryCategories.id],
    }),
    movements: many(inventoryMovements),
  }),
);

export const inventoryMovementsRelations = relations(
  inventoryMovements,
  ({ one }) => ({
    item: one(inventoryItems, {
      fields: [inventoryMovements.itemId],
      references: [inventoryItems.id],
    }),
    location: one(locations, {
      fields: [inventoryMovements.locationId],
      references: [locations.id],
    }),
    appointment: one(appointments, {
      fields: [inventoryMovements.appointmentId],
      references: [appointments.id],
    }),
    recordedBy: one(users, {
      fields: [inventoryMovements.recordedByUserId],
      references: [users.id],
    }),
  }),
);
