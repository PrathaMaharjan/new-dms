import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { locations } from "./tenancy";
import { appointments } from "./scheduling";
import { inventoryItems } from "./inventory";

export const treatmentCategoryEnum = pgEnum("treatment_category", [
  "preventive",
  "restorative",
  "cosmetic",
  "surgical",
  "orthodontic",
  "periodontic",
  "endodontic",
  "pediatric",
]);

export const anesthesiaTypeEnum = pgEnum("anesthesia_type", [
  "none",
  "local",
  "sedation",
  "general",
]);

export const treatments = pgTable(
  "treatments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCents: integer("price_cents").notNull(),
    sessions: integer("sessions").notNull().default(1),
    anesthesia: anesthesiaTypeEnum("anesthesia").notNull().default("none"),
    recoveryTime: text("recovery_time"),
    description: text("description"),
    procedureSteps: text("procedure_steps").array(),
    aftercareInstructions: text("aftercare_instructions").array(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    locationIdx: index("treatments_location_id_idx").on(table.locationId),
    locationNameUnique: unique("treatments_location_id_name_unique").on(
      table.locationId,
      table.name,
    ),
  }),
);

export const treatmentSupplies = pgTable(
  "treatment_supplies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treatmentId: uuid("treatment_id")
      .notNull()
      .references(() => treatments.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    quantityRequired: integer("quantity_required").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    treatmentIdx: index("treatment_supplies_treatment_id_idx").on(
      table.treatmentId,
    ),
    // One row per (treatment, item) pair - can't list the same supply
    // twice for one treatment; editing quantity means updating this row,
    // not inserting a duplicate.
    treatmentItemUnique: unique("treatment_supplies_treatment_item_unique").on(
      table.treatmentId,
      table.itemId,
    ),
  }),
);

// export const treatmentsRelations = relations(treatments, ({ one }) => ({
//   location: one(locations, { fields: [treatments.locationId], references: [locations.id] }),
// }));
export const treatmentsRelations = relations(treatments, ({ one, many }) => ({
  location: one(locations, {
    fields: [treatments.locationId],
    references: [locations.id],
  }),
  appointments: many(appointments),
}));
export const treatmentSuppliesRelations = relations(
  treatmentSupplies,
  ({ one }) => ({
    treatment: one(treatments, {
      fields: [treatmentSupplies.treatmentId],
      references: [treatments.id],
    }),
    item: one(inventoryItems, {
      fields: [treatmentSupplies.itemId],
      references: [inventoryItems.id],
    }),
  }),
);
