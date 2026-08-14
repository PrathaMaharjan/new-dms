import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointmentTypes, locations, organizations, treatments } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const locationId = request.nextUrl.searchParams.get("locationId") ?? undefined;
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug")?.trim() || undefined;

    let orgLocationIds: string[] | null = null;
    if (tenantSlug) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.slug, tenantSlug),
      });

      if (!org) {
        return NextResponse.json(
          { success: false, error: `Organization not found for tenant slug: ${tenantSlug}` },
          { status: 404, headers: corsHeaders }
        );
      }

      const orgLocations = await db
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.orgId, org.id));

      orgLocationIds = orgLocations.map((l) => l.id);
    }

    const appointmentTypesWhere = locationId
      ? orgLocationIds
        ? and(eq(appointmentTypes.locationId, locationId), inArray(appointmentTypes.locationId, orgLocationIds))
        : eq(appointmentTypes.locationId, locationId)
      : orgLocationIds
        ? inArray(appointmentTypes.locationId, orgLocationIds)
        : undefined;

    const treatmentsWhere = locationId
      ? orgLocationIds
        ? and(eq(treatments.locationId, locationId), inArray(treatments.locationId, orgLocationIds))
        : eq(treatments.locationId, locationId)
      : orgLocationIds
        ? inArray(treatments.locationId, orgLocationIds)
        : undefined;

    const [typesList, treatmentsList] = await Promise.all([
      appointmentTypesWhere
        ? db.select({ id: appointmentTypes.id, name: appointmentTypes.name }).from(appointmentTypes).where(appointmentTypesWhere)
        : db.select({ id: appointmentTypes.id, name: appointmentTypes.name }).from(appointmentTypes),
      treatmentsWhere
        ? db.select({ id: treatments.id, name: treatments.name }).from(treatments).where(treatmentsWhere)
        : db.select({ id: treatments.id, name: treatments.name }).from(treatments),
    ]);

    const combined = [...typesList, ...treatmentsList];
    const uniqueServices = Array.from(
      new Map(combined.filter((s) => Boolean(s.name)).map((s) => [s.name.trim(), s])).values()
    );

    return NextResponse.json(
      {
        success: true,
        statusCode: 200,
        data: { treatments: uniqueServices },
      },
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Failed to load public treatments" },
      { status: 500, headers: corsHeaders }
    );
  }
}
