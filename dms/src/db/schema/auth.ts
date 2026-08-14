// import { index } from "drizzle-orm/gel-core";
import { pgTable, text, timestamp, uuid ,index} from "drizzle-orm/pg-core";
import { users } from "./tenancy";
import { platformAdmins } from "./platfrom";
import { relations } from "drizzle-orm";

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("refresh_tokens_user_id_idx").on(table.userId),
  })
);
export const passwordResetOtps = pgTable(
  "password_reset_otps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    otpHash: text("otp_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("password_reset_otps_user_id_idx").on(table.userId),
  })
);
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({ userIdx: index("password_reset_tokens_user_id_idx").on(table.userId) })
);
export const platformAdminRefreshTokens = pgTable(
  "platform_admin_refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platformAdminId: uuid("platform_admin_id").notNull().references(() => platformAdmins.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    adminIdx: index("platform_admin_refresh_tokens_admin_id_idx").on(table.platformAdminId),
  })
);

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const platformAdminRefreshTokensRelations = relations(
  platformAdminRefreshTokens,
  ({ one }) => ({
    platformAdmin: one(platformAdmins, {
      fields: [platformAdminRefreshTokens.platformAdminId],
      references: [platformAdmins.id],
    }),
  })
);