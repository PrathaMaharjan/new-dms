import { UserErrorCode } from "@/controller/userDetails/controller";
import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { requireSession, SessionError } from "@/lib/auth/get-session";
import { eq } from "drizzle-orm";

export type OrganizationErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "SERVER_ERROR";

export async function requireOwner(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return user?.isOwner === true;
}
export type ToggleInventoryResult =
  | { success: true; inventoryEnabled: boolean }
  | { success: false; error: string; code: OrganizationErrorCode };

export async function toggleInventoryEnabled(inventoryEnabled: boolean): Promise<ToggleInventoryResult> {
  try {
    const session = await requireSession();

    if (!(await requireOwner(session.userId))) {
      return { success: false, error: "Only the organization owner can change this setting.", code: "FORBIDDEN" };
    }

    const [updated] = await db
      .update(organizations)
      .set({ inventoryEnabled })
      .where(eq(organizations.id, session.orgId))
      .returning({ inventoryEnabled: organizations.inventoryEnabled });

    return { success: true, inventoryEnabled: updated.inventoryEnabled };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong updating the setting.", code: "SERVER_ERROR" };
  }
}


export type GetInventoryStatusResult =
  | { success: true; inventoryEnabled: boolean }
  | { success: false; error: string; code: OrganizationErrorCode };


export async function getInventoryStatus(): Promise<GetInventoryStatusResult> {
  try {
    const session = await requireSession();

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, session.orgId),
      columns: { inventoryEnabled: true },
    });

    if (!org) {
      return { success: false, error: "Organization not found.", code: "NOT_FOUND" };
    }

    return { success: true, inventoryEnabled: org.inventoryEnabled };
  } catch (err) {
    if (err instanceof SessionError) {
      return { success: false, error: err.message, code: "UNAUTHORIZED" };
    }
    console.error(err);
    return { success: false, error: "Something went wrong loading the inventory setting.", code: "SERVER_ERROR" };
  }
}