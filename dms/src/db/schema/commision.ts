import { pgTable, uuid, text, integer, timestamp, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./tenancy";
import { users } from "./tenancy";
import { appointments } from "./scheduling";
import { ledgerEntries } from "./billing";
import { treatments } from "./treatment";

export const commissionExperienceTiers = pgTable(
  "commission_experience_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    name: text("name").notNull(),
    minYears: integer("min_years").notNull(),
    maxYears: integer("max_years"), // null = no upper bound
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("commission_tiers_org_id_idx").on(table.orgId),
  })
);

export const treatmentCommissionRates = pgTable(
  "treatment_commission_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treatmentId: uuid("treatment_id").notNull().references(() => treatments.id, { onDelete: "cascade" }),
    tierId: uuid("tier_id").notNull().references(() => commissionExperienceTiers.id, { onDelete: "cascade" }),
    commissionPercent: integer("commission_percent").notNull(), // whole number, e.g. 20 = 20%
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    treatmentTierUnique: unique("treatment_commission_treatment_tier_unique").on(table.treatmentId, table.tierId),
  })
);

export const doctorCommissions = pgTable(
  "doctor_commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id").notNull().references(() => users.id),
    appointmentId: uuid("appointment_id").notNull().unique().references(() => appointments.id),
    ledgerEntryId: uuid("ledger_entry_id").notNull().references(() => ledgerEntries.id),
    treatmentId: uuid("treatment_id").notNull().references(() => treatments.id),
    tierId: uuid("tier_id").references(() => commissionExperienceTiers.id), 
    commissionPercent: integer("commission_percent").notNull(),
    chargeAmountCents: integer("charge_amount_cents").notNull(),
    commissionAmountCents: integer("commission_amount_cents").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    doctorIdx: index("doctor_commissions_doctor_id_idx").on(table.doctorId),
  })
);

export const commissionExperienceTiersRelations = relations(commissionExperienceTiers, ({ many }) => ({
  rates: many(treatmentCommissionRates),
}));
export const treatmentCommissionRatesRelations = relations(treatmentCommissionRates, ({ one }) => ({
  treatment: one(treatments, { fields: [treatmentCommissionRates.treatmentId], references: [treatments.id] }),
  tier: one(commissionExperienceTiers, { fields: [treatmentCommissionRates.tierId], references: [commissionExperienceTiers.id] }),
}));
export const doctorCommissionsRelations = relations(doctorCommissions, ({ one }) => ({
  doctor: one(users, { fields: [doctorCommissions.doctorId], references: [users.id] }),
  appointment: one(appointments, { fields: [doctorCommissions.appointmentId], references: [appointments.id] }),
  treatment: one(treatments, { fields: [doctorCommissions.treatmentId], references: [treatments.id] }),
}));

