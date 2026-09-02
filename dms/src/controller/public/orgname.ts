import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getOrganizationBySlug(slug: string) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
    columns: { id: true, name: true, slug: true, photoUrl: true },
  });
  if (!org) {
    return { success: false, error: "Organization not found." };
  }
  return { success: true, organization: org };
}