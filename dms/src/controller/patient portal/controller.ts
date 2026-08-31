import { db } from "@/db";
import crypto from "crypto";
import {
  organizations,
  patientRefreshTokens,
  patients,
  patientVerificationCodes,
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
import { and, eq, gt, isNull, sql } from "drizzle-orm";

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
