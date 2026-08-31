import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { patients } from "./patients";

export const patientVerificationCodes = pgTable(
  "patient_verification_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index("patient_verification_codes_patient_id_idx").on(
      table.patientId,
    ),
  }),
);

export const patientRefreshTokens = pgTable("patient_refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id")
    .notNull()
    .references(() => patients.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
