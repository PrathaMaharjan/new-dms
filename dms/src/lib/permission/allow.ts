import { db } from "@/db";
import { users, userLocationRoles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { AccessTokenPayload } from "@/lib/auth/tokens";

export async function canManageExpenses(
  session: AccessTokenPayload,
  locationId: string,
): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { isOwner: true },
  });

  if (user?.isOwner) return true;

  const locationRole = await db.query.userLocationRoles.findFirst({
    where: and(
      eq(userLocationRoles.userId, session.userId),
      eq(userLocationRoles.locationId, locationId),
      eq(userLocationRoles.role, "manager"),
    ),
  });

  return !!locationRole;
}