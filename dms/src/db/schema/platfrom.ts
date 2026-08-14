import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { platformAdminRefreshTokens } from "./auth";
import { relations } from "drizzle-orm";

// Deliberately NOT part of the org/location/user hierarchy - a platform admin
// works across every clinic on the platform, not inside any single one of them.
// This is you (or your team) managing customers, not a clinic staff role.
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const platformAdminsRelations = relations(platformAdmins, ({ many }) => ({
  refreshTokens: many(platformAdminRefreshTokens),
}));