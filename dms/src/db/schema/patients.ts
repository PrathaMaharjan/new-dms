import {
  integer,
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  index,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, locations, users } from "./tenancy";
import { appointments } from "./scheduling";
import { ledgerEntries } from "./billing";
import { odontogramEntries } from "./clinical";
import { number } from "zod";

export const bloodEnum = pgEnum("blood_group", [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
]);
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    age: integer("age"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    gender: text("gender").default(""),
    bloodGroup: bloodEnum("blood_group").default("A+"),
    treatmentCompleted: boolean("treatment_completed").notNull().default(false),
    assignedDoctorId: uuid("assigned_doctor_id").references(() => users.id),
    dob: date("dob"),
    phone: text("phone"),
    email: text("email"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    orgLocationIdx: index("patients_org_location_idx").on(
      table.orgId,
      table.locationId,
    ),
    orgLastNameIdx: index("patients_org_last_name_idx").on(
      table.orgId,
      table.lastName,
    ),
    orgPhoneIdx: index("patients_org_phone_idx").on(table.orgId, table.phone),
  }),
);
export const medicalRecordTypeEnum = pgEnum("medical_record_type", ["allergy", "condition", "medication"]);

export const patientMedicalRecords = pgTable(
  "patient_medical_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Cascades - consistent with the hard-delete decision made earlier.
    // If patients cascades through appointments/notes/ledger, this table
    // has to cascade too, or a patient delete would fail here instead.
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    type: medicalRecordTypeEnum("type").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("patient_medical_records_patient_id_idx").on(table.patientId),
  })
);

export const patientMedicalRecordsRelations = relations(patientMedicalRecords, ({ one }) => ({
  patient: one(patients, { fields: [patientMedicalRecords.patientId], references: [patients.id] }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [patients.orgId],
    references: [organizations.id],
  }),
  odontogramEntries: many(odontogramEntries),
  ledgerEntries: many(ledgerEntries),
  homeLocation: one(locations, {
    fields: [patients.locationId],
    references: [locations.id],
  }),
  appointments: many(appointments),
}));
