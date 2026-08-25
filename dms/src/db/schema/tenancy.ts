import {
  integer,
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
  unique,
  date,
  time,
  check,
  boolean,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { patients } from "./patients";
import { appointmentTypes, appointments } from "./scheduling";
import { refreshTokens } from "./auth";

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contractor",
]);
export const shiftEnum = pgEnum("shift", ["morning", "afternoon", "night"]);
export const orgStatusEnum = pgEnum("org_status", [
  "trial",
  "active",
  "suspended",
  "cancelled",
]);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: orgStatusEnum("status").notNull().default("trial"),
    slug: text("slug").notNull().unique(),
    photoUrl: text("photo_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    workloadHealthyMax: integer("workload_healthy_max").notNull().default(15),
    workloadBusyMax: integer("workload_busy_max").notNull().default(20),
    inventoryEnabled: boolean("inventory_enabled").notNull().default(true),
  },

  (table) => ({
    statusIdx: index("organizations_status_idx").on(table.status),
  }),
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Main Branch"),
    address: text("address"),
    city: text("city"),
    phone: text("phone"),
    email: text("email"),
    openingTime: time("opening_time"),
    closingTime: time("closing_time"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    timezone: text("timezone").notNull().default("UTC"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("locations_org_id_idx").on(table.orgId),
    orgNameUnique: unique("locations_org_id_name_unique").on(
      table.orgId,
      table.name,
    ),
  }),
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    phone: text("phone").unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    photoUrl: text("photo_url"),
    shift: shiftEnum("shift"),
    joinDate: date("join_date"),
    gender: text("gender"),
    address: text("address"),
    // notes: text("notes"),
    isOwner: boolean("is_owner").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("users_org_id_idx").on(table.orgId),
  }),
);

// src/db/schema/tenancy.ts
export const staffRoleEnum = pgEnum("staff_role", [
  "owner",
  "manager",
  "clinical",
  "front_office",
]);

// owner        - full access: staff, settings, billing, reports, all patients at their locations
// clinical     - dentist + hygienist merged. Note: in most places a hygienist legally
//                can't diagnose or finalize a treatment plan - the system doesn't enforce
//                that boundary itself, since both share one role. Worth keeping in mind
//                if this ever needs tighter enforcement later.
// front_office - front desk + day-to-day billing: scheduling, check-in, payments, claims

// A staff member's role is scoped to a specific location, not the whole org -
// this is what lets a DSO office manager see only the locations they're assigned to.
export const userLocationRoles = pgTable(
  "user_location_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    role: staffRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userLocationUnique: unique().on(table.userId, table.locationId),
    locationIdx: index("user_location_roles_location_id_idx").on(
      table.locationId,
    ),
  }),
);
export const bloodGroupEnum = pgEnum("blood_group", [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
]);
export const specializationEnum = pgEnum("specialization", [
  "general_dentistry",
  "orthodontics",
  "endodontics",
  "periodontics",
  "oral_surgery",
  "pediatric_dentistry",
  "prosthodontics",
]);
export const providerProfiles = pgTable("provider_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  photoUrl: text("photo_url"),
  specialization: text("specialization"),
  qualification: text("qualification"),
  education: text("education"),
  bio: text("bio"),
  yearsOfExperience: integer("years_of_experience"),
  dateOfBirth: date("date_of_birth"),
  bloodGroup: bloodGroupEnum("blood_group"),
  gender: text("gender"),
  address: text("address"),
  employmentType: employmentTypeEnum("employment_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const providerSchedules = pgTable(
  "provider_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    // Nullable now - a day marked isOnLeave has no real hours to store.
    startTime: time("start_time"),
    endTime: time("end_time"),
    breakStartTime: time("break_start_time"),
    breakEndTime: time("break_end_time"),
    isOnLeave: boolean("is_on_leave").notNull().default(false),
    bufferTime: integer("buffer_time").notNull().default(30),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    providerLocationDayUnique: unique("provider_schedules_unique").on(
      table.userId,
      table.locationId,
      table.dayOfWeek,
    ),
    dayOfWeekCheck: check(
      "provider_schedules_day_of_week_check",
      sql`${table.dayOfWeek} BETWEEN 0 AND 6`,
    ),
  }),
);

// ---------- Relations (Drizzle query-API layer, not database FKs) ----------

export const organizationsRelations = relations(organizations, ({ many }) => ({
  locations: many(locations),
  users: many(users),
  patients: many(patients),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [locations.orgId],
    references: [organizations.id],
  }),
  staffRoles: many(userLocationRoles),
  patients: many(patients),
  appointmentTypes: many(appointmentTypes),
  appointments: many(appointments),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  refreshTokens: many(refreshTokens),
  locationRoles: many(userLocationRoles),
  appointmentsAsProvider: many(appointments),
}));

export const userLocationRolesRelations = relations(
  userLocationRoles,
  ({ one }) => ({
    user: one(users, {
      fields: [userLocationRoles.userId],
      references: [users.id],
    }),
    location: one(locations, {
      fields: [userLocationRoles.locationId],
      references: [locations.id],
    }),
  }),
);

export const providerProfilesRelations = relations(
  providerProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [providerProfiles.userId],
      references: [users.id],
    }),
  }),
);

export const providerSchedulesRelations = relations(
  providerSchedules,
  ({ one }) => ({
    user: one(users, {
      fields: [providerSchedules.userId],
      references: [users.id],
    }),
    location: one(locations, {
      fields: [providerSchedules.locationId],
      references: [locations.id],
    }),
  }),
);
