import { eq, and, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { treatments, locations, doctorTreatments, users, providerProfiles } from "@/db/schema";
import { resolveOrgBySlug } from "@/lib/public/resolve-org";
import { ensureDoctorTreatmentsTable } from "@/controller/doctor/controller";

export type PublicDoctorOption = {
  id: string;
  name: string;
  specialization?: string | null;
};

export type PublicTreatmentOption = {
  id: string;
  name: string;
  doctorIds?: string[];
  doctors?: PublicDoctorOption[];
};

export type TreatmentOptionsResult =
  | { success: true; treatments: PublicTreatmentOption[] }
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

    const treatmentIds = results.map((t) => t.id);
    const doctorMap = new Map<string, PublicDoctorOption[]>();

    if (treatmentIds.length > 0) {
      await ensureDoctorTreatmentsTable();
      const dtList = await db
        .select({
          treatmentId: doctorTreatments.treatmentId,
          doctorId: users.id,
          doctorName: users.name,
          specialization: providerProfiles.specialization,
        })
        .from(doctorTreatments)
        .innerJoin(users, eq(doctorTreatments.doctorId, users.id))
        .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
        .where(
          and(
            inArray(doctorTreatments.treatmentId, treatmentIds),
            isNull(users.deletedAt)
          )
        );

      for (const row of dtList) {
        const existing = doctorMap.get(row.treatmentId) || [];
        existing.push({
          id: row.doctorId,
          name: row.doctorName,
          specialization: row.specialization || null,
        });
        doctorMap.set(row.treatmentId, existing);
      }
    }

    const treatmentsWithDoctors: PublicTreatmentOption[] = results.map((t) => {
      const assigned = doctorMap.get(t.id) || [];
      return {
        id: t.id,
        name: t.name,
        doctorIds: assigned.map((d) => d.id),
        doctors: assigned,
      };
    });

    return { success: true, treatments: treatmentsWithDoctors };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Something went wrong loading treatments." };
  }
}