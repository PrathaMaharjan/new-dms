import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointmentTypes, locations, organizations, treatments } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getImageUrl } from "@/lib/cloudinary/storage";

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
    const locationId = request.nextUrl.searchParams.get("locationId")?.trim() || undefined;
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug")?.trim() || undefined;

    if (!tenantSlug && !locationId) {
      return NextResponse.json(
        { success: false, error: "tenantSlug or locationId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    let orgLocationIds: string[] = [];
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

      if (orgLocationIds.length === 0) {
        return NextResponse.json(
          { success: true, statusCode: 200, data: { treatments: [] } },
          { headers: corsHeaders }
        );
      }
    }

    const filterLocationIds = locationId
      ? orgLocationIds.length > 0
        ? orgLocationIds.filter((id) => id === locationId)
        : [locationId]
      : orgLocationIds;

    if (filterLocationIds.length === 0) {
      return NextResponse.json(
        { success: true, statusCode: 200, data: { treatments: [] } },
        { headers: corsHeaders }
      );
    }

    const [typesList, treatmentsList] = await Promise.all([
      db
        .select({
          id: appointmentTypes.id,
          name: appointmentTypes.name,
          category: sql<string>`'General'`,
          description: sql<string | null>`NULL`,
          priceCents: sql<number | null>`NULL`,
          durationMinutes: appointmentTypes.durationMinutes,
          imageUrl: sql<string | null>`NULL`,
        })
        .from(appointmentTypes)
        .where(inArray(appointmentTypes.locationId, filterLocationIds)),
      db
        .select({
          id: treatments.id,
          name: treatments.name,
          category: treatments.category,
          description: treatments.description,
          priceCents: treatments.priceCents,
          durationMinutes: treatments.durationMinutes,
          imageUrl: treatments.imageUrl,
        })
        .from(treatments)
        .where(inArray(treatments.locationId, filterLocationIds)),
    ]);

    const combined = [...typesList, ...treatmentsList];
    const uniqueServices = Array.from(
      new Map(
        combined
          .filter((s) => Boolean(s.name))
          .map((s) => {
            const resolvedImg = s.imageUrl ? getImageUrl(s.imageUrl, { width: 600, height: 450 }) : null;
            return [
              s.name.trim(),
              {
                ...s,
                imageUrl: resolvedImg,
              },
            ];
          })
      ).values()
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

