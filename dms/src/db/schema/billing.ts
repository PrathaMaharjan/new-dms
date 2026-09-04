import {
  pgTable,
  uuid,
  integer,
  timestamp,
  pgEnum,
  index,
  text,
  numeric,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, locations } from "./tenancy";
import { patients } from "./patients";
import { appointments } from "./scheduling";
import { treatments } from "./treatment";

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "charge",
  "payment",
  "adjustment",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "online",
]);
export const paymentStatusEnum = pgEnum("payment_status", ["due", "settled"]);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    paymentMethod: paymentMethodEnum("payment_method"),
    appointmentId: uuid("appointment_id").references(() => appointments.id, {
      onDelete: "cascade",
    }),
    status: paymentStatusEnum("status").notNull().default("due"),
    note: text("note"),
    type: ledgerEntryTypeEnum("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    // amountRupees: numeric("amount_rupees", {
    //   precision: 10,
    //   scale: 2,
    // }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("ledger_entries_patient_id_idx").on(table.patientId),
    orgLocationIdx: index("ledger_entries_org_location_idx").on(
      table.orgId,
      table.locationId,
    ),
  }),
);

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  organization: one(organizations, {
    fields: [ledgerEntries.orgId],
    references: [organizations.id],
  }),
  location: one(locations, {
    fields: [ledgerEntries.locationId],
    references: [locations.id],
  }),
  patient: one(patients, {
    fields: [ledgerEntries.patientId],
    references: [patients.id],
  }),
  appointment: one(appointments, {
    fields: [ledgerEntries.appointmentId],
    references: [appointments.id],
  }),
}));
