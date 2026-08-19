import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";

export type ResolveOrgResult =
  | { success: true; org: { id: string; name: string; slug: string; photoUrl: string | null; inventoryEnabled: boolean } }
  | { success: false; error: string };

export async function resolveOrgBySlug(slug: string): Promise<ResolveOrgResult> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
  });

  if (!org) {
    return { success: false, error: "This clinic could not be found." };
  }
  if (org.status === "suspended" || org.status === "cancelled") {
    return { success: false, error: "This clinic's page is currently unavailable." };
  }

  return {
    success: true,
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      photoUrl: org.photoUrl ?? null,
      inventoryEnabled: org.inventoryEnabled,
    },
  };
}