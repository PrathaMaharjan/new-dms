import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { locations, users } from "./tenancy";
import { patients } from "./patients";
import { clinicalNotes } from "./clinical";
import { ledgerEntries } from "./billing";
import { treatments } from "./treatment";

export const appointmentTypes = pgTable(
  "appointment_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    name: text("name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    locationIdx: index("appointment_types_location_id_idx").on(
      table.locationId,
    ),
  }),
);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "requested",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
]);
export const appointmentSourceEnum = pgEnum("appointment_source", [
  "staff",
  "online_booking",
]);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => users.id),
    treatmentId: uuid("treatment_id")
      .notNull()
      .references(() => treatments.id),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    status: appointmentStatusEnum("status").notNull().default("requested"),
    source: appointmentSourceEnum("source").notNull().default("staff"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    locationTimeIdx: index("appointments_location_time_idx").on(
      table.locationId,
      table.startTime,
    ),
    providerTimeIdx: index("appointments_provider_time_idx").on(
      table.providerId,
      table.startTime,
    ),
    patientIdx: index("appointments_patient_id_idx").on(table.patientId),
  }),
);

export const appointmentsRelations = relations(
  appointments,
  ({ one, many }) => ({
    location: one(locations, {
      fields: [appointments.locationId],
      references: [locations.id],
    }),
    patient: one(patients, {
      fields: [appointments.patientId],
      references: [patients.id],
    }),
    provider: one(users, {
      fields: [appointments.providerId],
      references: [users.id],
    }),
    treatment: one(treatments, {
      fields: [appointments.treatmentId],
      references: [treatments.id],
    }),
    clinicalNotes: many(clinicalNotes),
    ledgerEntries: many(ledgerEntries),
  }),
);
