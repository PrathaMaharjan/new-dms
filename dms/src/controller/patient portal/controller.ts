import { db } from "@/db";
import crypto from "crypto";
import {
  appointments,
  clinicalNotes,
  locations,
  organizations,
  patientMedicalRecords,
  patientRefreshTokens,
  patients,
  patientVerificationCodes,
  treatments,
  users,
} from "@/db/schema";
import {
  generatePatientRefreshToken,
  hashVerificationCode,
  signPatientAccessToken,
} from "@/lib/auth/patient-tokens";
import { transporter } from "@/lib/email/mailer";
import {
  requestPatientCodeSchema,
  verifyPatientCodeSchema,
} from "@/lib/validators/patent-portal";
import { and, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import {
  PatientSessionError,
  requirePatientSession,
} from "@/lib/auth/get-patient-seesion";

export type RequestCodeResult =
  | { success: true }
  | { success: false; error: string; code: "NOT_FOUND" | "VALIDATION" };
const CODE_EXPIRY_MINUTES = 10;
function generateSixDigitCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}
export async function requestPatientVerificationCode(
  input: unknown,
): Promise<RequestCodeResult> {
  const parsed = requestPatientCodeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
      code: "VALIDATION",
    };
  }
  const { email, organizationName } = parsed.data;
  console.log({
    email,
    organizationName,
  });

  const matchingOrgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(sql`lower(${organizations.name}) = lower(${organizationName})`);

  if (matchingOrgs.length === 0) {
    // CHANGED - now explicit, per your request. Reverses the anti-
    // enumeration protection: this confirms to anyone testing emails
    // whether a given org name exists at all.
    return {
      success: false,
      error: "This organization could not be found.",
      code: "NOT_FOUND",
    };
  }
  let patient = null;
  let matchedOrg = null;
  for (const org of matchingOrgs) {
    const found = await db.query.patients.findFirst({
      where: and(
        eq(patients.email, email),
        eq(patients.orgId, org.id),
        isNull(patients.deletedAt),
      ),
    });
    if (found) {
      patient = found;
      matchedOrg = org;
      break;
    }
  }
  if (!patient || !matchedOrg) {
    // CHANGED - explicit, matching what you asked for. Confirms to
    // anyone testing emails against this exact org name whether that
    // email is a real patient there or not.
    return {
      success: false,
      error:
        "No patient record found with this email for this organization. Please use the email address you provided when booking your appointment.",
      code: "NOT_FOUND",
    };
  }
  const code = generateSixDigitCode();
  const codeHash = hashVerificationCode(code);
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await db
    .insert(patientVerificationCodes)
    .values({ patientId: patient.id, codeHash, expiresAt });
  try {
    await transporter.sendMail({
      from: `"${matchedOrg.name}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Your verification code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; color: #374151;">
          <p>Hi ${patient.firstName},</p>
          <p>Your verification code is:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #3f6274;">${code}</p>
          <p>This code expires in ${CODE_EXPIRY_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send patient verification code:", err);
  }

  return { success: true };
}

export type VerifyCodeResult =
  | {
      success: true;
      accessToken: string;
      refreshToken: string;
      refreshTokenExpiresAt: Date;
      patient: { id: string; name: string; email: string };
    }
  | { success: false; error: string };

export async function verifyPatientCode(
  input: unknown,
): Promise<VerifyCodeResult> {
  const parsed = verifyPatientCodeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const { email, organizationName, code } = parsed.data;

  const matchingOrgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(sql`lower(${organizations.name}) = lower(${organizationName})`);

  let patient = null;
  let matchedOrgId = null;
  for (const org of matchingOrgs) {
    const found = await db.query.patients.findFirst({
      where: and(
        eq(patients.email, email),
        eq(patients.orgId, org.id),
        isNull(patients.deletedAt),
      ),
    });
    if (found) {
      patient = found;
      matchedOrgId = org.id;
      break;
    }
  }

  if (!patient || !matchedOrgId) {
    return { success: false, error: "Invalid code." };
  }

  const codeHash = hashVerificationCode(code);
  const validCode = await db.query.patientVerificationCodes.findFirst({
    where: and(
      eq(patientVerificationCodes.patientId, patient.id),
      eq(patientVerificationCodes.codeHash, codeHash),
      isNull(patientVerificationCodes.usedAt),
      gt(patientVerificationCodes.expiresAt, new Date()),
    ),
  });
  if (!validCode) {
    return { success: false, error: "Invalid or expired code." };
  }

  await db
    .update(patientVerificationCodes)
    .set({ usedAt: new Date() })
    .where(eq(patientVerificationCodes.id, validCode.id));

  const accessToken = signPatientAccessToken({
    patientId: patient.id,
    orgId: matchedOrgId,
  });
  const {
    token: refreshToken,
    tokenHash,
    expiresAt,
  } = generatePatientRefreshToken();
  await db
    .insert(patientRefreshTokens)
    .values({ patientId: patient.id, tokenHash, expiresAt });

  return {
    success: true,
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
    patient: {
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      email: patient.email ?? "",
    },
  };
}

export type PrescriptionEntry = {
  date: Date;
  prescription: string;
  doctorName: string;
  treatmentName: string;
  locationName: string; // ADDED
};

export type PrescriptionHistoryResult =
  | { success: true; prescriptions: PrescriptionEntry[] }
  | { success: false; error: string };

export async function getMyPrescriptionHistory(): Promise<PrescriptionHistoryResult> {
  try {
    const session = await requirePatientSession(); // { patientId, orgId }

    const rows = await db
      .select({
        date: appointments.startTime,
        prescription: clinicalNotes.prescription,
        doctorName: users.name,
        treatmentName: treatments.name,
        locationName: locations.name,
      })
      .from(clinicalNotes)
      .innerJoin(appointments, eq(clinicalNotes.appointmentId, appointments.id))
      .innerJoin(users, eq(appointments.providerId, users.id))
      .innerJoin(treatments, eq(appointments.treatmentId, treatments.id))
      .innerJoin(locations, eq(appointments.locationId, locations.id)) // ADDED
      .where(
        and(
          eq(appointments.patientId, session.patientId),
          isNotNull(clinicalNotes.prescription),
        ),
      )
      .orderBy(desc(appointments.startTime));

    return {
      success: true,
      prescriptions: rows.map((r) => ({ ...r, prescription: r.prescription! })),
    };
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading your prescriptions.",
    };
  }
}

export type PatientProfileData = {
  personal: {
    fullName: string;
    dob: string | null;
    gender: string | null;
    bloodGroup: string | null;
  };
  contact: {
    mobile: string | null;
    email: string | null;
    // address: string | null;
    preferredLanguage: string | null;
  };
  // emergencyContact: {
  //   name: string | null; // ADDED - null for now, no columns exist yet
  //   relationship: string | null;
  //   mobile: string | null;
  // };
  medicalFlags: {
    allergies: string[];
    conditions: string[];
    medications: string[];
  };
};

export type PatientProfileResult =
  | { success: true; data: PatientProfileData }
  | { success: false; error: string };

export async function getMyProfile(): Promise<PatientProfileResult> {
  try {
    const session = await requirePatientSession();

    const patient = await db.query.patients.findFirst({
      where: eq(patients.id, session.patientId),
    });
    if (!patient) {
      return { success: false, error: "Patient not found." };
    }

    const medicalRecords = await db
      .select({
        type: patientMedicalRecords.type,
        value: patientMedicalRecords.value,
      })
      .from(patientMedicalRecords)
      .where(eq(patientMedicalRecords.patientId, session.patientId));

    return {
      success: true,
      data: {
        personal: {
          fullName: `${patient.firstName} ${patient.lastName}`,
          dob: patient.dob,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
        },
        contact: {
          mobile: patient.phone,
          email: patient.email,
          // address: null, // no `address` column on patients yet - see note below
          preferredLanguage: "english",
        },
        medicalFlags: {
          allergies: medicalRecords
            .filter((r) => r.type === "allergy")
            .map((r) => r.value),
          conditions: medicalRecords
            .filter((r) => r.type === "condition")
            .map((r) => r.value),
          medications: medicalRecords
            .filter((r) => r.type === "medication")
            .map((r) => r.value),
        },
      },
    };
  } catch (err) {
    if (err instanceof PatientSessionError) {
      return { success: false, error: err.message };
    }
    console.error(err);
    return {
      success: false,
      error: "Something went wrong loading your profile.",
    };
  }
}

export type LogoutResult = { success: true };

export async function logoutPatient(
  refreshToken: string | undefined,
): Promise<LogoutResult> {
  if (refreshToken) {
    try {
      const tokenHash = crypto
        .createHmac("sha256", process.env.PATIENT_REFRESH_TOKEN_SECRET!)
        .update(refreshToken)
        .digest("hex");
      await db
        .update(patientRefreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(patientRefreshTokens.tokenHash, tokenHash));
    } catch (err) {
      console.error(
        "Failed to revoke patient refresh token during logout:",
        err,
      );
    }
  }

  return { success: true };
}
