import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, locations, organizations, patients, treatments, users } from "@/db/schema";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

const PublicBookingSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().optional(),
  preferredDate: z.string().min(1, "Date is required"),
  preferredTime: z.string().min(1, "Time is required"),
  notes: z.string().optional(),
  serviceName: z.string().optional(),
  dentistName: z.string().optional(),
  tenantSlug: z.string().optional(),
  locationId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = PublicBookingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || "Invalid booking data" },
        { status: 400, headers: corsHeaders }
      );
    }

    const data = parsed.data;

    // 1. Resolve Location & Organization
    let location = null;
    if (data.locationId) {
      location = await db.query.locations.findFirst({ where: eq(locations.id, data.locationId) });
    }

    if (!location && data.tenantSlug) {
      const org = await db.query.organizations.findFirst({ where: eq(organizations.slug, data.tenantSlug) });
      if (org) {
        location = await db.query.locations.findFirst({ where: eq(locations.orgId, org.id) });
      }
    }

    if (!location) {
      // Default to Sunrise Dental Group location if available, otherwise first location
      const sunriseOrg = await db.query.organizations.findFirst({ where: eq(organizations.slug, "sunrise-dental-group") });
      if (sunriseOrg) {
        location = await db.query.locations.findFirst({ where: eq(locations.orgId, sunriseOrg.id) });
      }
    }

    if (!location) {
      location = await db.query.locations.findFirst();
    }

    if (!location) {
      return NextResponse.json(
        { success: false, error: "No clinic location found to receive bookings." },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Resolve Treatment (MUST be a valid row in `treatments` table for this location so innerJoin succeeds)
    let treatment = data.serviceName
      ? await db.query.treatments.findFirst({
          where: and(
            eq(treatments.locationId, location.id),
            ilike(treatments.name, data.serviceName.trim())
          ),
        })
      : null;

    if (!treatment && data.serviceName) {
      treatment = await db.query.treatments.findFirst({
        where: ilike(treatments.name, data.serviceName.trim()),
      });
    }

    if (!treatment) {
      treatment = await db.query.treatments.findFirst({
        where: eq(treatments.locationId, location.id),
      });
    }

    if (!treatment) {
      const [newTreatment] = await db
        .insert(treatments)
        .values({
          locationId: location.id,
          name: data.serviceName?.trim() || "General Consultation",
          category: "preventive",
          durationMinutes: 30,
          priceCents: 0,
        })
        .returning();
      treatment = newTreatment;
    }

    // 3. Resolve Doctor/Provider
    const isNoPreference =
      !data.dentistName ||
      data.dentistName.toLowerCase().includes("no preference") ||
      data.dentistName.toLowerCase() === "none";

    let provider = !isNoPreference
      ? await db.query.users.findFirst({
          where: and(
            eq(users.orgId, location.orgId),
            ilike(users.name, data.dentistName!.trim()),
            isNull(users.deletedAt)
          ),
        })
      : null;

    if (!provider) {
      provider = await db.query.users.findFirst({
        where: and(eq(users.orgId, location.orgId), isNull(users.deletedAt)),
      });
    }

    if (!provider) {
      return NextResponse.json(
        { success: false, error: "No doctor found at this clinic to assign booking." },
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Find or Create Patient for this Organization
    const trimmedName = data.fullName.trim();
    const [firstName, ...rest] = trimmedName.split(" ");
    const lastName = rest.join(" ") || "-";

    const identifierMatch = data.email && data.email.trim() !== ""
      ? or(eq(patients.phone, data.phone), eq(patients.email, data.email))
      : eq(patients.phone, data.phone);

    let patient = await db.query.patients.findFirst({
      where: and(eq(patients.orgId, location.orgId), identifierMatch),
    });

    if (!patient) {
      const [newPatient] = await db
        .insert(patients)
        .values({
          orgId: location.orgId,
          locationId: location.id,
          firstName,
          lastName,
          phone: data.phone,
          email: data.email || null,
        })
        .returning();
      patient = newPatient;
    } else {
      // Keep patient profile aligned with latest public booking details
      // so Pending Review displays the submitted name/contact.
      const [updatedPatient] = await db
        .update(patients)
        .set({
          firstName,
          lastName,
          phone: data.phone,
          email: data.email || patient.email || null,
          locationId: patient.locationId || location.id,
        })
        .where(eq(patients.id, patient.id))
        .returning();
      patient = updatedPatient || patient;
    }

    // 5. Parse Start Time & End Time
    const startTime = new Date(`${data.preferredDate}T${data.preferredTime}:00`);
    const durationMs = (treatment.durationMinutes || 30) * 60_000;
    const endTime = new Date(startTime.getTime() + durationMs);

    // 6. Insert Appointment with status: "requested"
    const [newAppointment] = await db
      .insert(appointments)
      .values({
        locationId: location.id,
        patientId: patient.id,
        providerId: provider.id,
        treatmentId: treatment.id,
        startTime: isNaN(startTime.getTime()) ? new Date() : startTime,
        endTime: isNaN(endTime.getTime()) ? new Date(Date.now() + durationMs) : endTime,
        status: "requested",
        source: "online_booking",
        notes: data.notes || `Online booking for ${data.serviceName || treatment.name}`,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        statusCode: 201,
        data: {
          appointmentId: newAppointment.id,
          patientId: patient.id,
          locationId: location.id,
        },
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: unknown) {
    console.error("Public booking error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to book appointment." },
      { status: 500, headers: corsHeaders }
    );
  }
}
