import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userLocationRoles, users } from "@/db/schema";

export const ROLE_REDIRECT_PATHS = {
  owner: "organization",
  manager: "admin",
  clinical: "doctor",
  front_office: "frontdesk",
} as const;

// Checked in priority order once a LOCATION role is known - owner is
// resolved separately, before this list is ever consulted, since it's
// not a userLocationRoles value at all.
const LOCATION_ROLE_PRIORITY = ["manager", "clinical", "front_office"] as const;

export async function getPrimaryRoleForUser(
  userId: string
): Promise<keyof typeof ROLE_REDIRECT_PATHS | null> {
  // Org-wide owner check happens FIRST and short-circuits everything
  // else - an owner has no userLocationRoles row at all, so checking
  // that table first would incorrectly return null for them.
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user?.isOwner) {
    return "owner";
  }

  const roleRows = await db.query.userLocationRoles.findMany({
    where: eq(userLocationRoles.userId, userId),
  });

  if (roleRows.length === 0) return null;

  const heldRoles = new Set(roleRows.map((r) => r.role));
  for (const role of LOCATION_ROLE_PRIORITY) {
    if (heldRoles.has(role)) return role;
  }
  return null;
}

export async function getRedirectPathForUser(userId: string, orgSlug: string): Promise<string | null> {
  const role = await getPrimaryRoleForUser(userId);
  console.log("role : ",role)

  return role ? `/t/${orgSlug}/${ROLE_REDIRECT_PATHS[role]}` : null;
}