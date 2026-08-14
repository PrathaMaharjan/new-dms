import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { treatments, locations } from "@/db/schema";
import { resolveOrgBySlug } from "@/lib/public/resolve-org";

export type TreatmentOptionsResult =
  | { success: true; treatments: { id: string; name: string }[] }
  | { success: false; error: string };

export async function getPublicTreatmentOptions(
  tenantSlug: string,
  locationId?: string
): Promise<TreatmentOptionsResult> {
  const orgResult = await resolveOrgBySlug(tenantSlug);
  if (!orgResult.success) {
    return { success: false, error: orgResult.error };
  }
  const orgId = orgResult.org.id;

  try {
    const whereClause = locationId
      ? and(eq(treatments.locationId, locationId), eq(locations.orgId, orgId))
      : eq(locations.orgId, orgId);

    const results = await db
      .select({ id: treatments.id, name: treatments.name })
      .from(treatments)
      .innerJoin(locations, eq(treatments.locationId, locations.id))
      .where(whereClause)
      .orderBy(treatments.name);

    return { success: true, treatments: results };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Something went wrong loading treatments." };
  }
}