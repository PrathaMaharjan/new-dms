import { pgTable, uuid, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { appointments } from "./scheduling";
import { users } from "./tenancy";
import { patients } from "./patients";
export const clinicalNotes = pgTable(
  "clinical_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id),
    providerId: uuid("provider_id").notNull().references(() => users.id),
    noteText: text("note_text"),
    prescription: text("prescription"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    appointmentUnique: unique("clinical_notes_appointment_id_unique").on(table.appointmentId),
  })
);

export const odontogramEntries = pgTable(
  "odontogram_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    toothNumber: integer("tooth_number").notNull(),
    condition: text("condition").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    patientToothUnique: unique("odontogram_patient_tooth_unique").on(
      table.patientId,
      table.toothNumber
    ),
  })
);


export const clinicalNotesRelations = relations(clinicalNotes, ({ one }) => ({
  appointment: one(appointments, {
    fields: [clinicalNotes.appointmentId],
    references: [appointments.id],
  }),
  provider: one(users, {
    fields: [clinicalNotes.providerId],
    references: [users.id],
  }),
}));

export const odontogramEntriesRelations = relations(odontogramEntries, ({ one }) => ({
  patient: one(patients, {
    fields: [odontogramEntries.patientId],
    references: [patients.id],
  }),
}));