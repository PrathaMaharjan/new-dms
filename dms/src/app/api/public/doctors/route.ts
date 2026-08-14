import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizations, users, userLocationRoles } from "@/db/schema";
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
    const locationId = request.nextUrl.searchParams.get("locationId") ?? undefined;
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug")?.trim() || undefined;

    let orgId: string | undefined;
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
      orgId = org.id;
    }

    const clinicalDoctors = await db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .leftJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
      .where(
        and(
          isNull(users.deletedAt),
          orgId ? eq(users.orgId, orgId) : undefined,
          locationId ? eq(userLocationRoles.locationId, locationId) : undefined,
          eq(userLocationRoles.role, "clinical")
        )
      )
      .orderBy(users.name);

    // Deduplicate by name string so options are strictly unique
    const uniqueDoctors = Array.from(
      new Map(clinicalDoctors.filter((d) => Boolean(d.name)).map((d) => [d.name.trim(), d])).values()
    );

    return NextResponse.json(
      {
        success: true,
        statusCode: 200,
        data: { doctors: uniqueDoctors },
      },
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Failed to load public doctors" },
      { status: 500, headers: corsHeaders }
    );
  }
}
