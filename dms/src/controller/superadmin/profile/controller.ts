import { db } from "@/db";
import { platformAdminRefreshTokens, platformAdmins } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import {
  requireSuperAdminSession,
  SuperAdminSessionError,
} from "@/lib/auth/supperadmin-session";
import { superAdminChangePasswordSchema, updateSuperAdminDetailsSchema } from "@/lib/validators/superadmin";
import { eq } from "drizzle-orm";

export type SuperAdminErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "DUPLICATE"
  | "SERVER_ERROR";

export type GetSuperAdminDetailsResult =
  | { success: true; admin: { id: string; name: string; email: string } }
  | { success: false; error: string; code: SuperAdminErrorCode };

export async function getSuperAdminDetails(): Promise<GetSuperAdminDetailsResult> {
  try {
    const session = await requireSuperAdminSession();

    const admin = await db.query.platformAdmins.findFirst({
      where: eq(platformAdmins.id, session.adminId),
    });
    if (!admin) {
      return {
        success: false,
        error: "Account not found.",
        code: "VALIDATION",
      };
    }

    return {
      success: true,
      admin: { id: admin.id, name: admin.name, email: admin.email },
    };
  } catch (err) {
    if (err instanceof SuperAdminSessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading your details.",
      code: "SERVER_ERROR",
    };
  }
}

// update detail
export type UpdateSuperAdminDetailsResult =
  | { success: true; admin: { id: string; name: string; email: string;} }
  | { success: false; error: string; code: SuperAdminErrorCode };
export async function updateSuperAdminDetails(
  input: unknown,
): Promise<UpdateSuperAdminDetailsResult> {
  try {
    const session = await requireSuperAdminSession();

    const parsed = updateSuperAdminDetailsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
        code: "VALIDATION",
      };
    }
    const data = parsed.data;
    const updates: Record<string, unknown> = {};
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const current = await db.query.platformAdmins.findFirst({
        where: eq(platformAdmins.id, session.adminId),
      });
      if (!current) {
        return {
          success: false,
          error: "Account not found.",
          code: "VALIDATION",
        };
      }
      const [currentFirst, ...currentRest] = current.name.split(" ");
      const firstName = data.firstName ?? currentFirst;
      const lastName = data.lastName ?? currentRest.join(" ");
      updates.name = [firstName, lastName].filter(Boolean).join(" ");
    }
    if (data.email !== undefined) updates.email = data.email;
    if (data.phone !== undefined) updates.phone = data.phone;

    if (Object.keys(updates).length === 0) {
      return {
        success: false,
        error: "No fields to update.",
        code: "VALIDATION",
      };
    }
    const [updated] = await db
      .update(platformAdmins)
      .set(updates)
      .where(eq(platformAdmins.id, session.adminId))
      .returning();

    return {
      success: true,
      admin: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
      },
    };
  } catch (err) {
    if (err instanceof SuperAdminSessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
   
    console.error(err);
    return {
      success: false,
      error: "Something went wrong updating your details.",
      code: "SERVER_ERROR",
    };
  }
}

// change password 
export type ChangeSuperAdminPasswordResult = { success: true } | { success: false; error: string; code: SuperAdminErrorCode };

export async function changeSuperAdminPassword(input: unknown): Promise<ChangeSuperAdminPasswordResult> {
  try {
    const session = await requireSuperAdminSession();

    const parsed = superAdminChangePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input.", code: "VALIDATION" };
    }
    const data = parsed.data;

    const admin = await db.query.platformAdmins.findFirst({ where: eq(platformAdmins.id, session.adminId) });
    if (!admin) {
      return { success: false, error: "Account not found.", code: "VALIDATION" };
    }
       const isValid = await verifyPassword(data.oldPassword, admin.passwordHash);
    if (!isValid) {
      return { success: false, error: "Current password is incorrect.", code: "VALIDATION" };
    }

    const isSamePassword = await verifyPassword(data.newPassword, admin.passwordHash);
    if (isSamePassword) {
      return { success: false, error: "New password must be different from your current password.", code: "VALIDATION" };
    }

    const newPasswordHash = await hashPassword(data.newPassword);
        await db.transaction(async (tx) => {
      await tx.update(platformAdmins).set({ passwordHash: newPasswordHash }).where(eq(platformAdmins.id, session.adminId));
  
      await tx
        .update(platformAdminRefreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(platformAdminRefreshTokens.platformAdminId, session.adminId));
    });

    return { success: true };
  } catch (err) {
    if (err instanceof SuperAdminSessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong changing your password.", code: "SERVER_ERROR" };
  }
}