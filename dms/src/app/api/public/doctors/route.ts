import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizations, users, userLocationRoles, providerProfiles } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getImageUrl } from "@/lib/cloudinary/storage";
import { toSemanticHtml, toCleanPlainText } from "@/lib/formatters/richText";

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
        specialization: providerProfiles.specialization,
        qualification: providerProfiles.qualification,
        photoUrl: providerProfiles.photoUrl,
        yearsOfExperience: providerProfiles.yearsOfExperience,
        bio: providerProfiles.bio,
      })
      .from(users)
      .leftJoin(userLocationRoles, eq(userLocationRoles.userId, users.id))
      .leftJoin(providerProfiles, eq(providerProfiles.userId, users.id))
      .where(
        and(
          isNull(users.deletedAt),
          orgId ? eq(users.orgId, orgId) : undefined,
          locationId ? eq(userLocationRoles.locationId, locationId) : undefined,
          eq(userLocationRoles.role, "clinical")
        )
      )
      .orderBy(users.name);

    // Deduplicate by name string and ensure photoUrl is a complete public URL
    const uniqueDoctors = Array.from(
      new Map(
        clinicalDoctors
          .filter((d) => Boolean(d.name))
          .map((d) => {
            const resolvedUrl = d.photoUrl ? getImageUrl(d.photoUrl, { width: 400, height: 400 }) : null;
            const formattedBio = toSemanticHtml(d.bio);
            const plainBio = toCleanPlainText(d.bio);
            const formattedQual = toSemanticHtml(d.qualification);
            const plainQual = toCleanPlainText(d.qualification);

            return [
              d.name.trim(),
              {
                id: d.id,
                name: d.name,
                specialization: d.specialization || null,
                qualification: plainQual || null,
                qualificationHtml: formattedQual || null,

                yearsOfExperience: d.yearsOfExperience ?? null,
                experience: d.yearsOfExperience ?? null,
                bio: formattedBio || plainBio || null,
                bioHtml: formattedBio || null,
                bioText: plainBio || null,
                experienceNotes: formattedBio || plainBio || null,
                experienceNotesHtml: formattedBio || null,
                imageUrl: resolvedUrl,
                photoUrl: resolvedUrl,
              },
            ];
          })
      ).values()
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

