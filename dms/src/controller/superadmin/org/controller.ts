// src/lib/controllers/superadmin-organizations.controller.ts
import crypto from "crypto";
import { hashPassword } from "@/lib/auth/hash";
import { sendStaffWelcomeEmail } from "@/lib/email/sendWelComeMail";
import { locations, organizations, users } from "@/db/schema";
import { slugify } from "@/lib/slugify";
import { requireSuperAdminSession, SuperAdminSessionError } from "@/lib/auth/supperadmin-session";
import { createOrganizationWithOwnerSchema, updateOrganizationSchema, updateOrganizationStatusSchema } from "@/lib/validators/superadmin";
import { db } from "@/db";
import { and, eq, ilike, sql } from "drizzle-orm";
import { imagePresets } from "@/lib/cloudinary/storage";

export type OrgErrorCode = "UNAUTHORIZED" | "VALIDATION" | "NOT_FOUND" | "DUPLICATE" | "SERVER_ERROR";


export type CreateOrgWithOwnerResult =
  | {
      success: true;
      organization: { id: string; name: string; slug: string };
      location: { id: string, name: string }, 
      owner: { id: string; email: string };
      emailSent: boolean;
    }
  | { success: false; error: string; code: OrgErrorCode };

export async function createOrganizationWithOwner(input: unknown): Promise<CreateOrgWithOwnerResult> {
  try {
    await requireSuperAdminSession();

    const parsed = createOrganizationWithOwnerSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const data = parsed.data;
    const tempPassword = data.password;

    const passwordHash = await hashPassword(tempPassword);

    // Organization, its first owner, AND its first location - all three
    // created together, atomically. An org with no location at all
    // can't actually be used (no appointments, no patients, no staff
    // assignment possible), so this isn't optional.
    const { organization, owner, location } = await db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({
          name: data.name,
          slug: data.slug ?? slugify(data.name),
          photoUrl: data.photoKey,
          status: data.status ?? "active",
        })
        .returning();

      const [ownerUser] = await tx
        .insert(users)
        .values({
          orgId: org.id,
          email: data.ownerEmail,
          phone: data.ownerPhone,
          passwordHash,
          name: data.ownerName,
          isOwner: true,
        })
        .returning();

      const [newLocation] = await tx
        .insert(locations)
        .values({
          orgId: org.id,
          name: "Main Branch",
        })
        .returning();

      return { organization: org, owner: ownerUser, location: newLocation };
    });

    let emailSent = true;
    try {
      await sendStaffWelcomeEmail(data.ownerEmail, data.ownerName, tempPassword, organization.name, "Owner");
    } catch (emailErr) {
      console.error("Organization created, but welcome email failed to send:", emailErr);
      emailSent = false;
    }

    return {
      success: true,
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      owner: { id: owner.id, email: owner.email },
      location: { id: location.id, name: location.name }, // ADDED
      emailSent,
    };
  } catch (err) {
    // RESTORED - the specific error handling that was lost
    if (err instanceof SuperAdminSessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
  
    console.error(err);
    return { success: false, error: "Something went wrong creating the organization.", code: "SERVER_ERROR" };
  }
}

export type GetOrganizationResult =
  | { success: true; organization: typeof organizations.$inferSelect }
  | { success: false; error: string; code: OrgErrorCode };

export async function getOrganizationById(orgId: string): Promise<GetOrganizationResult> {
  try {
    await requireSuperAdminSession();

    const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) });
    if (!org) {
      return { success: false, error: "Organization not found.", code: "NOT_FOUND" };
    }
    return { success: true, organization: org };
  } catch (err) {
    if (err instanceof SuperAdminSessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the organization.", code: "SERVER_ERROR" };
  }
}

export type OrgListRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  photoUrl: string | null;
  createdAt: Date;
  inventoryEnabled: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  email: string | null;
  outletCount: number;
};

export type GetOrganizationsResult =
  | { success: true; organizations: OrgListRow[]; pagination: { total: number; limit: number; offset: number } }
  | { success: false; error: string; code: OrgErrorCode };

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Platform-wide, not scoped by org - a superadmin sees every org that exists.
export async function getOrganizations(
  options?: { search?: string; status?: string; limit?: number; offset?: number }
): Promise<GetOrganizationsResult> {
  try {
    await requireSuperAdminSession();

    const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(options?.offset ?? 0, 0);

    const conditions = [];
    if (options?.search) conditions.push(ilike(organizations.name, `%${options.search}%`));
    if (options?.status) conditions.push(eq(organizations.status, options.status as any));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [results, countResult] = await Promise.all([
      db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          status: organizations.status,
          photoUrl: organizations.photoUrl,
          createdAt: organizations.createdAt,
          inventoryEnabled: organizations.inventoryEnabled,
          ownerName: users.name,
          ownerEmail: users.email,
          ownerPhone: users.phone,
          email: users.email,
          outletCount: sql<number>`(SELECT COUNT(*)::int FROM ${locations} WHERE ${locations.orgId} = ${organizations.id})`,
        })
        .from(organizations)
        .leftJoin(users, and(eq(users.orgId, organizations.id), eq(users.isOwner, true)))
        .where(whereClause)
        .orderBy(organizations.name)
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(organizations).where(whereClause),
    ]);

    return { success: true, organizations: results, pagination: { total: countResult[0]?.count ?? 0, limit, offset } };
  } catch (err) {
    if (err instanceof SuperAdminSessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading organizations.", code: "SERVER_ERROR" };
  }
}

export type UpdateOrgStatusResult =
  | { success: true; status: string }
  | { success: false; error: string; code: OrgErrorCode };

export async function updateOrganizationStatus(orgId: string, input: unknown): Promise<UpdateOrgStatusResult> {
  try {
    await requireSuperAdminSession();

    const parsed = updateOrganizationStatusSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }

    const [updated] = await db
      .update(organizations)
      .set({ status: parsed.data.status })
      .where(eq(organizations.id, orgId))
      .returning({ status: organizations.status });

    if (!updated) {
      return { success: false, error: "Organization not found.", code: "NOT_FOUND" };
    }
    return { success: true, status: updated.status };
  } catch (err) {
    if (err instanceof SuperAdminSessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating the status.", code: "SERVER_ERROR" };
  }
}

// src/lib/controllers/superadmin-organizations.controller.ts
export type UpdateOrgResult =
  | { success: true; organization: { id: string; name: string; slug: string; photoUrl: string | null; status: string; inventoryEnabled: boolean } }
  | { success: false; error: string; code: OrgErrorCode };

// No ownership WHERE clause beyond the ID itself - a superadmin can edit
// ANY org, unlike every other update function in this project which
// scopes by session.orgId. Still one round trip: UPDATE...RETURNING
// doubles as the existence check.
export async function updateOrganization(orgId: string, input: unknown): Promise<UpdateOrgResult> {
  try {
    await requireSuperAdminSession();

    const parsed = updateOrganizationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const data = parsed.data;

    if (Object.keys(data).length === 0) {
      return { success: false, error: "No fields to update.", code: "VALIDATION" };
    }

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.slug !== undefined) updates.slug = data.slug;
    if (data.photoKey !== undefined) updates.photoUrl = data.photoKey;
    if (data.status !== undefined) updates.status = data.status;
    if (data.inventoryEnabled !== undefined) updates.inventoryEnabled = data.inventoryEnabled;

    if (Object.keys(updates).length > 0) {
      await db
        .update(organizations)
        .set(updates)
        .where(eq(organizations.id, orgId));
    }

    const userUpdates: Record<string, unknown> = {};
    if (data.ownerName !== undefined) userUpdates.name = data.ownerName;
    if (data.ownerEmail !== undefined) userUpdates.email = data.ownerEmail;
    if (data.ownerPhone !== undefined) userUpdates.phone = data.ownerPhone;

    if (Object.keys(userUpdates).length > 0) {
      await db
        .update(users)
        .set(userUpdates)
        .where(and(eq(users.orgId, orgId), eq(users.isOwner, true)));
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      return { success: false, error: "Organization not found.", code: "NOT_FOUND" };
    }

    return {
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        inventoryEnabled: org.inventoryEnabled,
        photoUrl: imagePresets.thumbnail(org.photoUrl),
      },
    };
  } catch (err) {
    if (err instanceof SuperAdminSessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
  
    console.error(err);
    return { success: false, error: "Something went wrong updating the organization.", code: "SERVER_ERROR" };
  }
}