import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { locations, organizations } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

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
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug")?.trim();

    if (!tenantSlug) {
      return NextResponse.json(
        { success: false, error: "tenantSlug is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, tenantSlug),
    });

    if (!org) {
      return NextResponse.json(
        {
          success: false,
          error: `Organization not found for tenant slug: ${tenantSlug}`,
        },
        { status: 404, headers: corsHeaders },
      );
    }

    const orgLocations = await db
      .select({
        id: locations.id,
        name: locations.name,
        address: locations.address,
        phone: locations.phone,
        email: locations.email,
      })
      .from(locations)
      .where(eq(locations.orgId, org.id))
      .orderBy(locations.name);

    return NextResponse.json(
      {
        success: true,
        statusCode: 200,
        data: { locations: orgLocations, orgname: org.name },
      },
      { headers: corsHeaders },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Failed to load public locations" },
      { status: 500, headers: corsHeaders },
    );
  }
}
